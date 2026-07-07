"""Modelo Adjunto: archivos subidos a tickets o comentarios."""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ticket import Ticket


class Adjunto(Base):
    __tablename__ = "adjuntos"

    id: Mapped[UUID] = mapped_column(
        server_default=func.gen_random_uuid(), primary_key=True
    )
    ticket_id: Mapped[UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    comentario_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("comentarios.id", ondelete="CASCADE"), nullable=True
    )
    archivo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    nombre_archivo: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tamano_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )

    __table_args__ = (
        Index("idx_adjuntos_ticket", "ticket_id"),
        Index("idx_adjuntos_comentario", "comentario_id"),
    )

    def __repr__(self) -> str:
        return f"<Adjunto id={self.id} nombre={self.nombre_archivo!r}>"