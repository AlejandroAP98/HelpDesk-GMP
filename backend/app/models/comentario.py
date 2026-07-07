"""Modelo Comentario: historial de conversacion + notas internas."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Comentario(Base):
    __tablename__ = "comentarios"

    id: Mapped[UUID] = mapped_column(
        server_default=func.gen_random_uuid(), primary_key=True
    )
    ticket_id: Mapped[UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )
    contenido: Mapped[str] = mapped_column(Text, nullable=False)
    es_nota_interna: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Comentario id={self.id} ticket_id={self.ticket_id}>"