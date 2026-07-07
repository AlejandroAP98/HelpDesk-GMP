"""Integracion Redis Pub/Sub para difundir eventos WebSocket entre instancias.

Canal unico: `helpdesk:ws`

Modelo:
    - El router `/ws` solo conecta/desconecta al ConnectionManager local.
    - Cualquier servicio (ticket_service, comentario_service, ...) publica mensajes
      al canal `helpdesk:ws` -> Redis los difunde a TODAS las instancias.
    - Cada instancia corre un task asincrono (`pubsub_listener`) que escucha el canal
      y despacha el mensaje al ConnectionManager local segun `target` del payload.

Target soportados:
    - {"target": "roles", "roles": ["agente","administrador"], "event": ...}
    - {"target": "ticket", "ticket_id": "...", "event": ...}
    - {"target": "broadcast", "event": ...}
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from uuid import UUID

from app.core.redis import redis_client
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


async def pubsub_listener() -> None:
    """Escucha el canal Redis y despacha a conexiones locales."""
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(CHANNEL)
    logger.info("WS Pub/Sub escuchando canal %s", CHANNEL)
    try:
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
            elif target == "broadcast":
                await manager.broadcast_all(event)
    except asyncio.CancelledError:
        logger.info("WS Pub/Sub detenido")
    finally:
        await pubsub.unsubscribe(CHANNEL)
        await pubsub.close()