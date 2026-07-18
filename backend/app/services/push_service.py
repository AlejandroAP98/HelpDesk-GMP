"""Servicio de push notifications (Web Push VAPID).

Responsabilidad:
    - Enviar notificaciones push a las suscripciones registradas de un usuario.
    - Limpiar suscripciones muertas (404/410 Gone).
    - Ser tolerante a errores: un fallo en una subscription no afecta a las demas.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from pywebpush import webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

_VAPID_KEY_CACHE: str | None = None

MAX_SUBS_USUARIO = 5
PURGA_DIAS_SIN_USO = 30


def _select_subs_to_prune(subs: list[PushSubscription]) -> list[PushSubscription]:
    """Elige suscripciones a purgar: mas de MAX_SUBS_USUARIO o viejas sin uso."""
    to_delete: list[PushSubscription] = []
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=PURGA_DIAS_SIN_USO)
    for s in subs:
        if s.ultimo_envio_at is None and s.fecha_creacion < cutoff:
            to_delete.append(s)
    restantes = [s for s in subs if s not in to_delete]
    if len(restantes) > MAX_SUBS_USUARIO:
        restantes.sort(
            key=lambda s: s.ultimo_envio_at or s.fecha_creacion,
            reverse=True,
        )
        to_delete.extend(restantes[MAX_SUBS_USUARIO:])
        restantes = restantes[:MAX_SUBS_USUARIO]
    return to_delete


def _get_vapid_key() -> str | None:
    """Devuelve la private key VAPID en formato base64url (como pywebpush espera)."""
    global _VAPID_KEY_CACHE
    if _VAPID_KEY_CACHE is not None:
        return _VAPID_KEY_CACHE
    raw = settings.vapid_private_key
    if not raw:
        return None
    _VAPID_KEY_CACHE = raw
    logger.info("VAPID key lista (base64url, %d chars)", len(raw))
    return _VAPID_KEY_CACHE


def _is_vapid_configured() -> bool:
    return bool(
        settings.vapid_public_key
        and settings.vapid_private_key
        and settings.vapid_subject
    )


async def get_user_subscriptions(
    user_id: UUID, db: AsyncSession
) -> list[PushSubscription]:
    rows = await db.execute(
        select(PushSubscription).where(PushSubscription.usuario_id == user_id)
    )
    return list(rows.scalars().all())


async def _send_web(
    sub: PushSubscription,
    payload: dict[str, Any],
    vapid_key: str,
) -> tuple[bool, bool]:
    """Envia push Web (VAPID). Retorna (entregado, murio)."""
    subscription_info = {
        "endpoint": sub.endpoint,
        "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key},
    }
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=86400,
        )
        return True, False
    except Exception as exc:
        msg = str(exc).lower()
        if "410" in msg or "404" in msg or "gone" in msg or "not found" in msg:
            logger.info("Push web subscription %s muerta, sera eliminada", sub.id)
            return False, True
        logger.warning("Error enviando push web a subscription %s: %s", sub.id, exc)
        return False, False


async def send_push_to_user(
    user_id: UUID,
    title: str,
    body: str,
    url: str,
    data: dict[str, Any] | None = None,
    db: AsyncSession | None = None,
) -> int:
    """Envia un push a TODAS las suscripciones de un usuario."""
    if db is None:
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            return await send_push_to_user(user_id, title, body, url, data, session)

    payload = {
        "title": title,
        "body": body,
        "url": url,
        "prioridad": (data or {}).get("prioridad", ""),
        "data": data or {},
    }

    subs = await get_user_subscriptions(user_id, db)
    if not subs:
        return 0

    to_prune = _select_subs_to_prune(subs)
    if to_prune:
        for s in to_prune:
            await db.delete(s)
            subs.remove(s)
        if not subs:
            try:
                await db.commit()
            except Exception:
                await db.rollback()
            return 0
        logger.info("Purgadas %d suscripciones duplicadas/viejas para %s", len(to_prune), user_id)

    if not _is_vapid_configured():
        return 0

    vapid_key = _get_vapid_key()
    if vapid_key is None:
        return 0

    delivered = 0
    dead: list[PushSubscription] = []
    for sub in subs:
        ok, murio = await _send_web(sub, payload, vapid_key)
        if ok:
            delivered += 1
            sub.ultimo_envio_at = datetime.now(timezone.utc)
        if murio:
            dead.append(sub)
    for sub in dead:
        await db.delete(sub)
    if dead or delivered:
        try:
            await db.commit()
        except Exception:
            await db.rollback()
    return delivered


async def send_push_to_users(
    user_ids: list[UUID],
    title: str,
    body: str,
    url: str,
    data: dict[str, Any] | None = None,
) -> int:
    """Envia push a varios usuarios. Reusa una sola sesion para todos."""
    if not user_ids:
        return 0
    total = 0
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        for uid in user_ids:
            total += await send_push_to_user(uid, title, body, url, data, session)
    return total