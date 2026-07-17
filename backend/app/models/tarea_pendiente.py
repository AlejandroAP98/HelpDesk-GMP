"""Modelo TareaPendiente: checklist interno de agentes/admins."""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.usuario import Usuario


class TareaPendiente(Base):
    __tablename__ = "tareas_pendientes"

    id: Mapped[UUID] = mapped_column(
        server_default=func.gen_random_uuid(), primary_key=True
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False
    )
    texto: Mapped[str] = mapped_column(String(500), nullable=False)
    completada: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ticket_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_tareas_usuario", "usuario_id"),
    )

    def __repr__(self) -> str:
        return f"<TareaPendiente id={self.id} texto={self.texto!r}>"
