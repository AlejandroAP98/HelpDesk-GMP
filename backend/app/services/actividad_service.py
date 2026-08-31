"""Servicio de actividad del dia (efimero, 24h) usando Redis.

- Cada evento se escribe en la clave de su empresa (`actividad:log:{empresa_id}`)
  y en la clave global (`actividad:log:all`) para consulta de admins globales.
- Listas acotadas con LTRIM a los ultimos 1000 eventos (control de memoria).
- El broadcast WebSocket se envia SOLO a admin/mesa_ayuda de la empresa del
  evento (+ globales), evitando fuga de metadata entre empresas.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_client
from app.models.enums import RolUsuario
from app.models.usuario import Usuario

logger = logging.getLogger(__name__)

REDIS_KEY_PREFIX = "actividad:log:"
REDIS_KEY_GLOBAL = "actividad:log:all"
TTL_24H = 86400
MAX_EVENTS = 1000


async def _resolve_scope_users(empresa_id: int) -> list[UUID]:
    """Admins/mesa_ayuda de la empresa (o globales) que deben ver el evento."""
    async with AsyncSessionLocal() as session:
        rows = await session.execute(
            select(Usuario.id).where(
                Usuario.rol.in_([RolUsuario.administrador, RolUsuario.mesa_ayuda]),
                or_(
                    Usuario.empresa_id == empresa_id,
                    Usuario.empresa_id.is_(None),
                ),
            )
        )
        return [r[0] for r in rows.all()]


async def registrar(
    empresa_id: int,
    usuario_id: UUID,
    usuario_nombre: str,
    ticket_id: UUID | None,
    tipo_evento: str,
    metadata: dict | None = None,
) -> None:
    """Registra un evento de actividad en Redis con TTL 24h y lo difunde por WS.

    Tipos de evento soportados:
    - ticket_created / ticket_assigned / state_changed / priority_changed
    - ticket_reopened / comment_added / attachment_uploaded
    """
    evento = {
        "empresa_id": empresa_id,
        "usuario_id": str(usuario_id),
        "usuario_nombre": usuario_nombre,
        "ticket_id": str(ticket_id) if ticket_id else None,
        "tipo_evento": tipo_evento,
        "metadata": metadata or {},
        "fecha": datetime.now(timezone.utc).isoformat(),
    }

    try:
        key = f"{REDIS_KEY_PREFIX}{empresa_id}"
        await redis_client.rpush(key, json.dumps(evento))
        await redis_client.ltrim(key, -MAX_EVENTS, -1)
        await redis_client.expire(key, TTL_24H)
        await redis_client.rpush(REDIS_KEY_GLOBAL, json.dumps(evento))
        await redis_client.ltrim(REDIS_KEY_GLOBAL, -MAX_EVENTS, -1)
        await redis_client.expire(REDIS_KEY_GLOBAL, TTL_24H)
    except Exception:
        logger.warning("No se pudo registrar actividad en Redis", exc_info=True)

    try:
        from app.websockets.pubsub import publish_to_users

        user_ids = await _resolve_scope_users(empresa_id)
        if user_ids:
            await publish_to_users(
                user_ids,
                event={"type": "actividad:nueva", "actividad": evento},
            )
    except Exception:
        logger.warning("No se pudo publicar actividad:nueva por WebSocket", exc_info=True)


async def obtener_ultimas(empresa_id: int | None, limit: int = 20) -> list[dict]:
    """Obtiene los ultimos N eventos. `empresa_id=None` devuelve actividad global."""
    key = REDIS_KEY_GLOBAL if empresa_id is None else f"{REDIS_KEY_PREFIX}{empresa_id}"
    try:
        items = await redis_client.lrange(key, -limit, -1)
        return [json.loads(item) for item in reversed(items)]
    except Exception:
        logger.warning("No se pudo obtener actividad de Redis", exc_info=True)
        return []
