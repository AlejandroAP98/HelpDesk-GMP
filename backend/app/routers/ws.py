"""Endpoint WebSocket de HelpDesk-GMP.

Conexion:  ws://host:8000/ws?token=<JWT_access>
Cualquier usuario autenticado puede conectarse; las salas/rooms se gestionan por rol
en `ConnectionManager`. El cliente recibe eventos:
    - ticket:urgent_created   (solo agente/admin)
    - ticket:created          (broadcast)
    - ticket:updated          (broadcast o ticket especifico)
    - ticket:commented        (broadcast o ticket especifico)
"""
from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.usuario import Usuario
from app.websockets.manager import manager
from app.utils.exceptions import TokenInvalido

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


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
    return usuario


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: Annotated[str, Query()] = "",
    db: AsyncSession = Depends(get_db),
) -> None:
    if not token:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        usuario = await _resolve_user(token, db)
    except Exception as exc:
        logger.warning("WS conexion rechazada: %s", exc)
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    conn_id = uuid4()
    rol = usuario.rol.value if hasattr(usuario.rol, "value") else usuario.rol
    await manager.connect(
        conn_id=conn_id,
        ws=ws,
        rol=rol,
        usuario_id=usuario.id,
        empresa_id=usuario.empresa_id,
    )
    try:
        while True:
            data = await ws.receive_json()
            if isinstance(data, dict) and data.get("type") == "ping":
                await manager.send_personal(
                    conn_id, {"type": "pong", "ts": data.get("ts")}
                )
            elif isinstance(data, dict) and data.get("type") == "subscribe_ticket":
                tid = data.get("ticket_id")
                if tid:
                    manager.subscribe_ticket(conn_id, UUID(tid))
            elif isinstance(data, dict) and data.get("type") == "unsubscribe_ticket":
                tid = data.get("ticket_id")
                if tid:
                    manager.unsubscribe_ticket(conn_id, UUID(tid))
    except WebSocketDisconnect:
        manager.disconnect(conn_id)
    except Exception:
        logger.exception("WS error inesperado en conexion %s", conn_id)
        manager.disconnect(conn_id)