"""Servicio de push notifications (Web Push VAPID + FCM/APNs nativo).

Responsabilidad:
    - Enviar notificaciones push a las suscripciones registradas de un usuario.
    - Soportar ambos canales: Web (VAPID) y Nativo (FCM para Android/APNs para iOS).
    - Limpiar suscripciones muertas (404/410 Gone en web, UNREGISTERED en FCM).
    - Ser tolerante a errores: un fallo en una subscription no afecta a las demas.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pywebpush import webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push_subscription import PushPlatform, PushSubscription

logger = logging.getLogger(__name__)

_VAPID_KEY_CACHE: str | None = None
_FCM_INITIALIZED = False


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


def _is_fcm_configured() -> bool:
    return bool(settings.firebase_credentials_path)


def _get_fcm_client():
    """Inicializa y devuelve el cliente de Firebase Admin SDK (singleton)."""
    global _FCM_INITIALIZED
    if _FCM_INITIALIZED:
        from firebase_admin import messaging
        return messaging
    if not _is_fcm_configured():
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(settings.firebase_credentials_path)
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred)
        from firebase_admin import messaging
        _FCM_INITIALIZED = True
        logger.info("Firebase Admin SDK inicializado")
        return messaging
    except Exception as exc:
        logger.error("Error inicializando Firebase Admin SDK: %s", exc)
        return None


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


async def _send_fcm(
    sub: PushSubscription,
    payload: dict[str, Any],
) -> tuple[bool, bool]:
    """Envia push nativo via FCM. Retorna (entregado, murio).

    FCM se usa tanto para Android directo como para iOS via FCM (cuando
    el .p8 de APNs esta configurado en Firebase Console).
    """
    messaging = _get_fcm_client()
    if messaging is None:
        return False, False

    prioridad = (payload.get("data") or {}).get("prioridad", "normal")
    fcm_priority = "high" if prioridad == "urgente" else "normal"

    message = messaging.Message(
        token=sub.endpoint,
        notification=messaging.Notification(
            title=payload.get("title", "HelpDesk"),
            body=payload.get("body", ""),
        ),
        data={k: str(v) for k, v in (payload.get("data") or {}).items()},
        android=messaging.AndroidConfig(
            priority=fcm_priority,
            notification=messaging.AndroidNotification(
                icon="ic_launcher",
                color="#2563eb",
                sound="default",
                channel_id="helpdesk-default",
            ),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    sound="default",
                    badge=1,
                    content_available=True,
                ),
            ),
            fcm_options=messaging.APNSFCMOptions(
                analytics_label=payload.get("data", {}).get("type", "helpdesk"),
            ),
        ),
    )

    try:
        message_id = messaging.send(message)
        logger.info("FCM push enviado: %s -> %s", sub.id, message_id)
        return True, False
    except Exception as exc:
        msg = str(exc).lower()
        if any(s in msg for s in [
            "unregistered",
            "invalid_argument",
            "not found",
            "not a valid fcm registration token",
            "registration-token-not-registered",
            "invalid-registration-token",
        ]):
            logger.info("FCM subscription %s muerta, sera eliminada: %s", sub.id, exc)
            return False, True
        logger.warning("Error enviando FCM push a subscription %s: %s", sub.id, exc)
        return False, False


async def _send_one(
    sub: PushSubscription,
    payload: dict[str, Any],
) -> tuple[bool, bool]:
    """Envia push a una subscription segun su plataforma. Retorna (entregado, murio)."""
    if sub.is_native:
        return await _send_fcm(sub, payload)
    elif sub.is_web:
        vapid_key = _get_vapid_key()
        if vapid_key is None:
            return False, False
        return await _send_web(sub, payload, vapid_key)
    else:
        logger.warning("Plataforma desconocida para subscription %s: %s", sub.id, sub.plataforma)
        return False, False


async def send_push_to_user(
    user_id: UUID,
    title: str,
    body: str,
    url: str,
    data: dict[str, Any] | None = None,
    db: AsyncSession | None = None,
) -> int:
    """Envia un push a TODAS las suscripciones de un usuario (web + nativas)."""
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

    delivered = 0
    dead: list[PushSubscription] = []
    for sub in subs:
        if sub.is_web and not _is_vapid_configured():
            continue
        if sub.is_native and not _is_fcm_configured():
            continue
        ok, murio = await _send_one(sub, payload)
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
