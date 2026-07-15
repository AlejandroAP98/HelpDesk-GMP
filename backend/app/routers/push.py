"""Endpoints REST para suscripciones Web Push."""
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.push_subscription import PushSubscription
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
    """Devuelve la public key VAPID. El frontend la usa para suscribirse."""
    return PushVapidKeyOut(public_key=settings.vapid_public_key)


@router.get("/subscriptions", response_model=list[PushSubscribeOut])
async def list_my_subscriptions(
    current: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PushSubscribeOut]:
    """Lista las suscripciones push del usuario autenticado."""
    rows = await db.execute(
        select(PushSubscription).where(PushSubscription.usuario_id == current.id)
    )
    return [
        PushSubscribeOut(
            id=str(s.id),
            endpoint=s.endpoint,
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
    """Registra (o actualiza) una suscripcion Web Push para el usuario."""
    existing = (
        await db.execute(
            select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.usuario_id = current.id
        existing.p256dh_key = data.keys.p256dh
        existing.auth_key = data.keys.auth
        existing.user_agent = data.user_agent
        sub = existing
    else:
        sub = PushSubscription(
            usuario_id=current.id,
            endpoint=data.endpoint,
            p256dh_key=data.keys.p256dh,
            auth_key=data.keys.auth,
            user_agent=data.user_agent,
        )
        db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return PushSubscribeOut(
        id=str(sub.id),
        endpoint=sub.endpoint,
        user_agent=sub.user_agent,
        fecha_creacion=sub.fecha_creacion.isoformat(),
    )


@router.post("/test", response_model=PushTestOut)
async def send_test_push(
    current: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PushTestOut:
    """Envia un push de prueba a TODAS las suscripciones del usuario autenticado.

    Util para verificar que el stack Web Push funciona end-to-end.
    Retorna la cantidad de dispositivos a los que se entrego el push.
    """
    delivered = await send_push_to_user(
        user_id=current.id,
        title="Notificacion de prueba",
        body=(
            "Si ves esto, las push nativas funcionan. "
            "Recibiras alertas de tickets aunque la app este cerrada o en background."
        ),
        url="/",
        data={"type": "test"},
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
