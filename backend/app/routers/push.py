"""Endpoints REST para suscripciones push (Web VAPID + FCM/APNs)."""
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.push_subscription import PushPlatform, PushSubscription
from app.models.usuario import Usuario
from app.schemas.push import (
    PushSubscribeIn,
    PushSubscribeOut,
    PushTestOut,
    PushUnsubscribeIn,
    PushVapidKeyOut,
)
from app.services.push_service import send_push_to_user

router = APIRouter(prefix="/api/push", tags=["push"])

logger = logging.getLogger(__name__)


@router.get("/vapid-public-key", response_model=PushVapidKeyOut)
async def get_vapid_public_key() -> PushVapidKeyOut:
    """Devuelve la public key VAPID. El frontend web la usa para suscribirse."""
    return PushVapidKeyOut(public_key=settings.vapid_public_key)


@router.get("/subscriptions", response_model=list[PushSubscribeOut])
async def list_my_subscriptions(
    current: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PushSubscribeOut]:
    """Lista las suscripciones push del usuario autenticado (web + nativas)."""
    rows = await db.execute(
        select(PushSubscription).where(PushSubscription.usuario_id == current.id)
    )
    return [
        PushSubscribeOut(
            id=str(s.id),
            endpoint=s.endpoint,
            plataforma=s.plataforma,
            user_agent=s.user_agent,
            fecha_creacion=s.fecha_creacion.isoformat(),
        )
        for s in rows.scalars().all()
    ]


@router.post("/subscribe", response_model=PushSubscribeOut, status_code=status.HTTP_201_CREATED)
async def subscribe(
    data: PushSubscribeIn,
    current: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PushSubscribeOut:
    """Registra o actualiza una suscripcion push para el usuario.

    Acepta suscripciones Web (VAPID) y nativas (FCM/APNs):
    - Web: requiere keys {p256dh, auth}
    - Nativo: solo endpoint (token) + plataforma (ios/android)
    """
    is_native = data.plataforma in ("ios", "android")

    if not is_native and (data.keys is None or not data.keys.p256dh or not data.keys.auth):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para suscripciones web se requieren keys p256dh y auth",
        )

    existing = (
        await db.execute(
            select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.usuario_id = current.id
        existing.plataforma = data.plataforma
        existing.p256dh_key = data.keys.p256dh if data.keys else None
        existing.auth_key = data.keys.auth if data.keys else None
        existing.user_agent = data.user_agent
        sub = existing
    else:
        sub = PushSubscription(
            usuario_id=current.id,
            plataforma=data.plataforma,
            endpoint=data.endpoint,
            p256dh_key=data.keys.p256dh if data.keys else None,
            auth_key=data.keys.auth if data.keys else None,
            user_agent=data.user_agent,
        )
        db.add(sub)
    await db.commit()
    await db.refresh(sub)

    logger.info(
        "Push subscription registrada: usuario=%s plataforma=%s endpoint=%s...",
        current.id,
        data.plataforma,
        data.endpoint[:30],
    )

    return PushSubscribeOut(
        id=str(sub.id),
        endpoint=sub.endpoint,
        plataforma=sub.plataforma,
        user_agent=sub.user_agent,
        fecha_creacion=sub.fecha_creacion.isoformat(),
    )


@router.post("/test", response_model=PushTestOut)
async def send_test_push(
    current: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PushTestOut:
    """Envia un push de prueba a TODAS las suscripciones del usuario autenticado.

    Funciona tanto para web (VAPID) como para nativo (FCM/APNs).
    """
    delivered = await send_push_to_user(
        user_id=current.id,
        title="Notificacion de prueba",
        body=(
            "Si ves esto, las push funcionan correctamente. "
            "Recibiras alertas de tickets aunque la app este cerrada o en background."
        ),
        url="/",
        data={"type": "test", "prioridad": "normal"},
        db=db,
    )
    return PushTestOut(delivered=delivered)


@router.delete("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    data: PushUnsubscribeIn,
    current: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Elimina una suscripcion (por endpoint) del usuario autenticado."""
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint,
            PushSubscription.usuario_id == current.id,
        )
    )
    await db.commit()
