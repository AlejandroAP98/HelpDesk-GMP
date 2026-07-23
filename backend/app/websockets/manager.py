"""Gestor de conexiones WebSocket con rooms por rol de usuario.

Permite enviar eventos en tiempo real filtrados por rol (clientes, agentes, admins),
por ticket especifico, o broadcast general. Disenno compatible con multiples instancias
del backend gracias a Redis Pub/Sub (ver `websockets/pubsub.py`).
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Mantiene conexiones activas indexadas por rol y por ticket."""

    def __init__(self) -> None:
        self.active: dict[UUID, WebSocket] = {}
        self.by_role: dict[str, set[UUID]] = defaultdict(set)
        self.by_ticket: dict[UUID, set[UUID]] = defaultdict(set)
        self.meta: dict[UUID, dict[str, Any]] = {}

    async def connect(
        self,
        conn_id: UUID,
        ws: WebSocket,
        rol: str,
        usuario_id: UUID,
        empresa_id: int | None = None,
        ticket_id: UUID | None = None,
    ) -> None:
        await ws.accept()
        self.active[conn_id] = ws
        self.by_role[rol].add(conn_id)
        if ticket_id is not None:
            self.by_ticket[ticket_id].add(conn_id)
        self.meta[conn_id] = {
            "rol": rol,
            "usuario_id": str(usuario_id),
            "empresa_id": empresa_id,
            "ticket_id": str(ticket_id) if ticket_id else None,
        }
        logger.info("WS conexion %s (rol=%s)", conn_id, rol)

    def disconnect(self, conn_id: UUID) -> None:
        meta = self.meta.pop(conn_id, None)
        self.active.pop(conn_id, None)
        if meta:
            rol = meta.get("rol")
            if rol and conn_id in self.by_role.get(rol, set()):
                self.by_role[rol].discard(conn_id)
            ticket = meta.get("ticket_id")
            if ticket:
                t_id = UUID(ticket) if isinstance(ticket, str) else ticket
                self.by_ticket.get(t_id, set()).discard(conn_id)

    async def send_personal(self, conn_id: UUID, payload: dict[str, Any]) -> bool:
        ws = self.active.get(conn_id)
        if ws is None:
            return False
        try:
            await ws.send_json(payload)
            return True
        except Exception:
            self.disconnect(conn_id)
            return False

    async def broadcast_to_roles(
        self, roles: list[str], payload: dict[str, Any]
    ) -> int:
        dest: list[UUID] = []
        for r in roles:
            dest.extend(self.by_role.get(r, set()))
        n = 0
        for cid in dest:
            if await self.send_personal(cid, payload):
                n += 1
        if n == 0 and dest:
            logger.debug("broadcast_to_roles: no se pudo enviar a %d destinos", len(dest))
        return n

    async def broadcast_to_ticket(
        self, ticket_id: UUID, payload: dict[str, Any]
    ) -> int:
        conns = list(self.by_ticket.get(ticket_id, set()))
        n = 0
        for cid in conns:
            if await self.send_personal(cid, payload):
                n += 1
        if n == 0 and conns:
            logger.debug("broadcast_to_ticket %s: no se pudo enviar a %d destinos", ticket_id, len(conns))
        return n

    async def broadcast_to_users(
        self, user_ids: list[UUID], payload: dict[str, Any]
    ) -> int:
        """Envia a las conexiones cuyo usuario_id este en la lista dada.

        Sirve para notificar eventos solo a los implicados (cliente/agente/admins)
        en lugar de hacer un broadcast global.
        """
        if not user_ids:
            return 0
        target_ids: set[UUID] = {u for u in user_ids if isinstance(u, UUID)}
        matched: list[UUID] = []
        for cid, meta in self.meta.items():
            uid_str = meta.get("usuario_id")
            if not uid_str:
                continue
            try:
                if UUID(uid_str) in target_ids:
                    matched.append(cid)
            except (TypeError, ValueError):
                continue
        n = 0
        for cid in matched:
            if await self.send_personal(cid, payload):
                n += 1
        if n == 0 and matched:
            logger.debug(
                "broadcast_to_users: no se pudo enviar a %d conexiones de %d usuarios",
                len(matched),
                len(target_ids),
            )
        return n

    async def broadcast_all(self, payload: dict[str, Any]) -> int:
        n = 0
        for cid in list(self.active.keys()):
            if await self.send_personal(cid, payload):
                n += 1
        logger.debug("broadcast_all: enviado a %d/%d conexiones", n, len(self.active))
        return n

    def get_connected_user_ids(self) -> set[UUID]:
        """Devuelve el set de usuario_id actualmente conectados por WebSocket.

        Utilizado por el push_dispatcher para NO enviar push a usuarios que ya
        estan viendo la app (reciben la notificacion via WS toast).
        """
        result: set[UUID] = set()
        for meta in self.meta.values():
            uid = meta.get("usuario_id")
            if uid:
                try:
                    result.add(UUID(uid))
                except (TypeError, ValueError):
                    continue
        return result

    def subscribe_ticket(self, conn_id: UUID, ticket_id: UUID) -> None:
        if conn_id not in self.active:
            return
        self.by_ticket[ticket_id].add(conn_id)
        if conn_id in self.meta:
            self.meta[conn_id]["ticket_id"] = str(ticket_id)

    def unsubscribe_ticket(self, conn_id: UUID, ticket_id: UUID) -> None:
        self.by_ticket.get(ticket_id, set()).discard(conn_id)
        if conn_id in self.meta and self.meta[conn_id].get("ticket_id") == str(ticket_id):
            self.meta[conn_id]["ticket_id"] = None


manager = ConnectionManager()
