"""Endpoint WebSocket de HelpDesk-GMP.

Conexion (auth post-handshake):
    1. Cliente abre ws://host:8000/ws (sin token en query).
    2. Cliente envia primer mensaje: {"type": "auth", "token": "<JWT_access>"}.
    3. Servidor responde {"type": "auth_ok"} o {"type": "auth_error"} + close 1008.
Cualquier usuario autenticado puede conectarse; las salas/rooms se gestionan por rol
en `ConnectionManager`. El cliente recibe eventos:
    - ticket:urgent_created   (solo agente/admin)
    - ticket:created          (broadcast)
    - ticket:updated          (broadcast o ticket especifico)
    - ticket:commented        (broadcast o ticket especifico)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import deque
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.enums import RolUsuario
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.websockets.manager import manager
from app.utils.exceptions import TokenInvalido

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

AUTH_TIMEOUT_S = 10.0
MAX_TICKET_SUBS = 50
FLOOD_WINDOW_S = 60.0
FLOOD_MAX_MSGS = 120


async def _resolve_user(token: str, db: AsyncSession) -> Usuario:
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise TokenInvalido() from exc
    usuario_id = payload.get("usuario_id")
    if not usuario_id:
        raise TokenInvalido("Claims incompletos")
    from sqlalchemy import select
    usuario = (
        await db.execute(select(Usuario).where(Usuario.id == UUID(usuario_id)))
    ).scalar_one_or_none()
    if usuario is None:
        raise TokenInvalido("Usuario inexistente")
    if not usuario.activo:
        raise TokenInvalido("Usuario inactivo")
    return usuario


async def _can_access_ticket(usuario: Usuario, ticket_id: UUID, db: AsyncSession) -> bool:
    """Valida si un usuario tiene acceso a un ticket para suscripcion WS.
    Misma semantica que `ticket_service.obtener` (tenant_filter + restriccion agente)."""
    from sqlalchemy import select

    ticket = (
        await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ).scalar_one_or_none()
    if ticket is None:
        return False
    rol = usuario.rol.value if hasattr(usuario.rol, "value") else usuario.rol
    if rol in (RolUsuario.administrador.value, RolUsuario.mesa_ayuda.value):
        return True
    if rol == RolUsuario.agente.value:
        return ticket.agente_id == usuario.id
    if rol == RolUsuario.cliente.value:
        return (
            usuario.empresa_id is not None
            and ticket.empresa_id == usuario.empresa_id
        )
    return False


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    db: AsyncSession = Depends(get_db),
) -> None:
    await ws.accept()
    try:
        raw = await asyncio.wait_for(ws.receive(), timeout=AUTH_TIMEOUT_S)
        first: Any = (
            json.loads(raw.get("text", ""))
            if raw.get("type") == "websocket.receive"
            else None
        )
    except asyncio.TimeoutError:
        logger.warning("WS auth timeout: primer mensaje no llegó en %ss", AUTH_TIMEOUT_S)
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    except WebSocketDisconnect:
        return
    except Exception as exc:
        logger.warning("WS auth primer mensaje invalido: %r", exc)
        try:
            await ws.send_json({"type": "auth_error"})
        except Exception:
            pass
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    token = (
        first.get("token")
        if isinstance(first, dict) and first.get("type") == "auth"
        else None
    )
    if not token or not isinstance(token, str):
        await ws.send_json({"type": "auth_error"})
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        usuario = await _resolve_user(token, db)
    except Exception as exc:
        logger.warning("WS conexion rechazada: %s", exc)
        try:
            await ws.send_json({"type": "auth_error"})
        except Exception:
            pass
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.send_json({"type": "auth_ok"})

    conn_id = uuid4()
    rol = usuario.rol.value if hasattr(usuario.rol, "value") else usuario.rol
    await manager.connect(
        conn_id=conn_id,
        ws=ws,
        rol=rol,
        usuario_id=usuario.id,
        empresa_id=usuario.empresa_id,
    )
    logger.info(
        "WS conexion aceptada: conn=%s usuario=%s rol=%s empresa=%s",
        conn_id,
        usuario.id,
        rol,
        usuario.empresa_id,
    )
    try:
        suscripciones: set[str] = set()
        ventana: deque[float] = deque()
        while True:
            data = await ws.receive_json()
            now = time.monotonic()
            ventana.append(now)
            while ventana and now - ventana[0] > FLOOD_WINDOW_S:
                ventana.popleft()
            if len(ventana) > FLOOD_MAX_MSGS:
                logger.warning(
                    "WS flood limit excedido: conn=%s usuario=%s (descarta mensaje)",
                    conn_id,
                    usuario.id,
                )
                continue
            if isinstance(data, dict) and data.get("type") == "ping":
                await manager.send_personal(
                    conn_id, {"type": "pong", "ts": data.get("ts")}
                )
            elif isinstance(data, dict) and data.get("type") == "subscribe_ticket":
                tid = data.get("ticket_id")
                if tid:
                    if len(suscripciones) >= MAX_TICKET_SUBS and tid not in suscripciones:
                        logger.warning(
                            "WS subs limit excedido: usuario=%s ticket=%s",
                            usuario.id,
                            tid,
                        )
                        continue
                    if await _can_access_ticket(usuario, UUID(tid), db):
                        suscripciones.add(tid)
                        manager.subscribe_ticket(conn_id, UUID(tid))
                    else:
                        logger.warning(
                            "WS subscribe_ticket rechazado: usuario=%s ticket=%s",
                            usuario.id,
                            tid,
                        )
            elif isinstance(data, dict) and data.get("type") == "unsubscribe_ticket":
                tid = data.get("ticket_id")
                if tid:
                    suscripciones.discard(tid)
                    manager.unsubscribe_ticket(conn_id, UUID(tid))
    except WebSocketDisconnect:
        manager.disconnect(conn_id)
    except Exception:
        logger.exception("WS error inesperado en conexion %s", conn_id)
        manager.disconnect(conn_id)