"""Modelo HistorialEstado: trazabilidad de cambios de estado en tickets."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Enum as SAEnum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import EstadoTicket


class HistorialEstado(Base):
    __tablename__ = "historial_estados"

    id: Mapped[UUID] = mapped_column(
        server_default=func.gen_random_uuid(), primary_key=True
    )
    ticket_id: Mapped[UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )
    estado_anterior: Mapped[EstadoTicket] = mapped_column(
        SAEnum(
            EstadoTicket,
            name="estado_ticket",
            create_type=False,
            validate_strings=True,
        ),
        nullable=False,
    )
    estado_nuevo: Mapped[EstadoTicket] = mapped_column(
        SAEnum(
            EstadoTicket,
            name="estado_ticket",
            create_type=False,
            validate_strings=True,
        ),
        nullable=False,
    )
    fecha: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )

    __table_args__ = (
        Index("idx_historial_ticket", "ticket_id"),
    )

    def __repr__(self) -> str:
        return f"<HistorialEstado ticket_id={self.ticket_id} {self.estado_anterior}->{self.estado_nuevo}>"
