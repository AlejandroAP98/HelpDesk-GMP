"""Modelo EventoCalendario: eventos programados con recordatorio opcional por email."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EventoCalendario(Base):
    __tablename__ = "eventos_calendario"

    id: Mapped[UUID] = mapped_column(
        server_default=func.gen_random_uuid(), primary_key=True
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False
    )
    ticket_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_inicio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    fecha_fin: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    recordar_email: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    minutos_antes: Mapped[int] = mapped_column(
        default=15, nullable=False
    )
    email_enviado: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )

    __table_args__ = (
        Index("idx_eventos_usuario", "usuario_id"),
        Index("idx_eventos_fecha_inicio", "fecha_inicio"),
        Index("idx_eventos_recordatorio", "recordar_email", "email_enviado", "fecha_inicio"),
    )

    def __repr__(self) -> str:
        return f"<EventoCalendario id={self.id} titulo={self.titulo!r}>"
