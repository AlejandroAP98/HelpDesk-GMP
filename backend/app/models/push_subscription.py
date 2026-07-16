"""Modelo PushSubscription: suscripciones de push por dispositivo/usuario.

Soporta dos tipos de suscripcion:
- Web Push (VAPID): endpoint = URL del push service (Mozilla/Google), keys {p256dh, auth}
- FCM (Android): endpoint = FCM token, keys vacias
- APNs (iOS): endpoint = APNs device token, keys vacias

El campo `plataforma` distingue entre web/ios/android para que el backend sepa
que servicio usar al enviar el push.
"""
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.usuario import Usuario


class PushPlatform(str, Enum):
    WEB = "web"
    ANDROID = "android"
    IOS = "ios"


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[UUID] = mapped_column(
        server_default=func.gen_random_uuid(), primary_key=True
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plataforma: Mapped[str] = mapped_column(
        String(16), nullable=False, default=PushPlatform.WEB.value
    )
    endpoint: Mapped[str] = mapped_column(String(700), unique=True, nullable=False)
    p256dh_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    auth_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )
    ultimo_envio_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return (
            f"<PushSubscription id={self.id} usuario_id={self.usuario_id} "
            f"plataforma={self.plataforma}>"
        )

    @property
    def is_native(self) -> bool:
        return self.plataforma in (PushPlatform.ANDROID.value, PushPlatform.IOS.value)

    @property
    def is_web(self) -> bool:
        return self.plataforma == PushPlatform.WEB.value
