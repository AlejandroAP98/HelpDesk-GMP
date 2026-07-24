"""Integracion Redis Pub/Sub para difundir eventos WebSocket entre instancias.

Canal unico: `helpdesk:ws`

Modelo:
    - El router `/ws` solo conecta/desconecta al ConnectionManager local.
    - Cualquier servicio (ticket_service, comentario_service, ...) publica mensajes
      al canal `helpdesk:ws` -> Redis los difunde a TODAS las instancias.
    - Cada instancia corre un task asincrono (`pubsub_listener`) que escucha el canal
      y despacha el mensaje al ConnectionManager local segun `target` del payload.
    - Ademas, el `push_dispatcher` toma los mismos eventos y envia Web Push
      a usuarios que NO estan conectados por WebSocket (asi reciben notificaciones
      nativas con la app cerrada o en background).

Target soportados:
    - {"target": "roles", "roles": ["agente","administrador"], "event": ...}
    - {"target": "ticket", "ticket_id": "...", "event": ...}
    - {"target": "users", "user_ids": ["uuid",...], "event": ...}
    - {"target": "broadcast", "event": ...}

Eventos que disparan Web Push:
    - ticket:urgent_created  -> push a roles agente+mesa_ayuda+administrador
    - ticket:new             -> push a roles mesa_ayuda+administrador
    - ticket:assigned        -> push al usuario asignado (event["agente_id"])
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_client
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.services.push_service import send_push_to_user, send_push_to_users
from app.websockets.manager import manager

logger = logging.getLogger(__name__)

CHANNEL = "helpdesk:ws"


async def publish_to_roles(roles: list[str], event: dict[str, Any]) -> None:
    payload = {
        "target": "roles",
        "roles": roles,
        "event": event,
    }
    await redis_client.publish(CHANNEL, json.dumps(payload))


async def publish_to_ticket(ticket_id: UUID, event: dict[str, Any]) -> None:
    payload = {
        "target": "ticket",
        "ticket_id": str(ticket_id),
        "event": event,
    }
    await redis_client.publish(CHANNEL, json.dumps(payload))


async def publish_broadcast(event: dict[str, Any]) -> None:
    payload = {"target": "broadcast", "event": event}
    await redis_client.publish(CHANNEL, json.dumps(payload))


async def publish_to_users(user_ids: list[UUID], event: dict[str, Any]) -> None:
    """Envia un evento solo a los usuarios cuyos IDs esten en la lista.

    Se usa para notificar a los implicados en un ticket (cliente, agente, admins)
    sin propagar a todos los conectados.
    """
    if not user_ids:
        return
    payload = {
        "target": "users",
        "user_ids": [str(u) for u in user_ids],
        "event": event,
    }
    await redis_client.publish(CHANNEL, json.dumps(payload))


async def _resolve_user_ids_by_roles(roles: list[str]) -> list[UUID]:
    async with AsyncSessionLocal() as session:
        rows = await session.execute(
            select(Usuario.id).where(Usuario.rol.in_(roles))
        )
        return [r[0] for r in rows.all()]


async def _dispatch_push(event: dict[str, Any], connected: set[UUID]) -> None:
    """Decide si el evento debe disparar push y a quien, excluyendo conectados."""
    etype = event.get("type")
    if not etype:
        return

    if etype == "ticket:urgent_created":
        role_values = [
            RolUsuario.agente.value,
            RolUsuario.mesa_ayuda.value,
            RolUsuario.administrador.value,
        ]
        user_ids = await _resolve_user_ids_by_roles(role_values)
        targets = [u for u in user_ids if u not in connected]
        if not targets:
            return
        title = "Ticket urgente"
        body = (
            f"{event.get('titulo', '')}\n"
            f"Estado: {event.get('estado', '')} - Prioridad: {event.get('prioridad', '')}"
        )
        url = f"/tickets/{event.get('ticket_id', '')}"
        delivered = await send_push_to_users(targets, title, body, url, data=event)
        if delivered:
            logger.info("Push urgente enviado a %d usuarios", delivered)

    elif etype == "ticket:new":
        role_values = [
            RolUsuario.mesa_ayuda.value,
            RolUsuario.administrador.value,
        ]
        user_ids = await _resolve_user_ids_by_roles(role_values)
        targets = [u for u in user_ids if u not in connected]
        if not targets:
            return
        title = "Nuevo ticket"
        body = (
            f"{event.get('titulo', '')}\n"
            f"Prioridad: {event.get('prioridad', '')} - {event.get('empresa_nombre') or ''}"
        )
        url = f"/tickets/{event.get('ticket_id', '')}"
        delivered = await send_push_to_users(targets, title, body, url, data=event)
        if delivered:
            logger.info("Push nuevo ticket enviado a %d usuarios", delivered)

    elif etype == "ticket:assigned":
        agente_id = event.get("agente_id")
        if not agente_id:
            return
        try:
            uid = UUID(agente_id)
        except (TypeError, ValueError):
            return
        title = "Te asignaron un ticket"
        body = (
            f"{event.get('titulo', '')}\n"
            f"Estado: {event.get('estado', '')} - Prioridad: {event.get('prioridad', '')}"
        )
        url = f"/tickets/{event.get('ticket_id', '')}"
        delivered = await send_push_to_user(uid, title, body, url, data=event)
        if delivered:
            logger.info("Push asignacion enviado a %s (conectado_ws=%s)", uid, uid in connected)
        else:
            logger.info("Push asignacion no entregado a %s (sin suscripciones o falló)", uid)


async def pubsub_listener() -> None:
    """Escucha el canal Redis y despacha a conexiones locales + push notifications."""
    try:
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(CHANNEL)
        logger.info("WS Pub/Sub escuchando canal %s", CHANNEL)
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data: dict[str, Any] = json.loads(message["data"])
            except (TypeError, json.JSONDecodeError):
                continue
            target = data.get("target")
            event = data.get("event", {})
            if target == "roles":
                await manager.broadcast_to_roles(data.get("roles", []), event)
            elif target == "ticket":
                tid = data.get("ticket_id")
                if tid:
                    await manager.broadcast_to_ticket(UUID(tid), event)
            elif target == "users":
                uids = data.get("user_ids", [])
                if uids:
                    await manager.broadcast_to_users([UUID(u) for u in uids], event)
            elif target == "broadcast":
                await manager.broadcast_all(event)
            try:
                event_id = event.get("event_id")
                if event_id:
                    acquired = await redis_client.set(
                        f"helpdesk:push_dispatched:{event_id}",
                        "1",
                        nx=True,
                        ex=60,
                    )
                    if not acquired:
                        continue
                connected = manager.get_connected_user_ids()
                await _dispatch_push(event, connected)
            except Exception:
                logger.exception("Push dispatcher fallo (no afecta WS)")
    except asyncio.CancelledError:
        logger.info("WS Pub/Sub detenido")
    except Exception:
        logger.exception("WS Pub/Sub listener fallo inesperado")
    finally:
        try:
            await pubsub.unsubscribe(CHANNEL)
            await pubsub.close()
        except Exception:
            pass
