"""Modelo Ticket: entidad central del helpdesk."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Computed, Enum as SAEnum
from sqlalchemy import ForeignKey, Index, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import EstadoTicket, ElementoInfraestructura, PrioridadTicket


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[UUID] = mapped_column(server_default=func.gen_random_uuid(), primary_key=True)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False
    )
    cliente_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )
    agente_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    modificado_por_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    categoria_id: Mapped[int] = mapped_column(
        ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False
    )
    subcategoria_id: Mapped[int] = mapped_column(
        ForeignKey("subcategorias.id", ondelete="RESTRICT"), nullable=False
    )
    elemento_afectado: Mapped[ElementoInfraestructura] = mapped_column(
        SAEnum(
            ElementoInfraestructura,
            name="elemento_infraestructura",
            create_type=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    titulo: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    ip_pcs: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_antena: Mapped[str | None] = mapped_column(Text, nullable=True)
    mascara_red: Mapped[str | None] = mapped_column(Text, nullable=True)
    puerta_enlace: Mapped[str | None] = mapped_column(Text, nullable=True)
    nombre_punto: Mapped[str | None] = mapped_column(Text, nullable=True)
    punto_venta_id: Mapped[int | None] = mapped_column(
        ForeignKey("puntos_venta.id", ondelete="SET NULL"), nullable=True
    )
    estado: Mapped[EstadoTicket] = mapped_column(
        SAEnum(
            EstadoTicket,
            name="estado_ticket",
            create_type=True,
            validate_strings=True,
        ),
        nullable=False,
        default=EstadoTicket.abierto,
        server_default=EstadoTicket.abierto.value,
    )
    prioridad: Mapped[PrioridadTicket] = mapped_column(
        SAEnum(
            PrioridadTicket,
            name="prioridad_ticket",
            create_type=True,
            validate_strings=True,
        ),
        nullable=False,
        default=PrioridadTicket.media,
        server_default=PrioridadTicket.media.value,
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(), nullable=False
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )
    fecha_asignacion: Mapped[datetime | None] = mapped_column(nullable=True, default=None)
    fecha_primera_respuesta: Mapped[datetime | None] = mapped_column(nullable=True, default=None)
    fecha_resolucion: Mapped[datetime | None] = mapped_column(nullable=True, default=None)
    peso_orden: Mapped[int] = mapped_column(
        SmallInteger,
        Computed(
            "CASE estado"
            " WHEN 'en_progreso'::estado_ticket THEN 1"
            " WHEN 'asignado'::estado_ticket THEN 2"
            " WHEN 'abierto'::estado_ticket THEN 3"
            " WHEN 'resuelto'::estado_ticket THEN 4"
            " WHEN 'cerrado'::estado_ticket THEN 5"
            " ELSE 6 END * 10 +"
            " CASE prioridad"
            " WHEN 'urgente'::prioridad_ticket THEN 1"
            " WHEN 'alta'::prioridad_ticket THEN 2"
            " WHEN 'media'::prioridad_ticket THEN 3"
            " WHEN 'baja'::prioridad_ticket THEN 4"
            " ELSE 5 END",
            persisted=True,
        ),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_tickets_empresa", "empresa_id"),
        Index("idx_tickets_estado", "estado"),
        Index("idx_tickets_prioridad", "prioridad"),
        Index("idx_tickets_agente", "agente_id"),
        Index("idx_tickets_cliente", "cliente_id"),
        Index("idx_tickets_fecha_creacion", "fecha_creacion"),
        Index("idx_tickets_empresa_fecha", "empresa_id", "fecha_creacion"),
        Index("idx_tickets_peso_orden", "peso_orden", "fecha_creacion"),
        Index("idx_tickets_punto_venta", "punto_venta_id"),
    )

    def __repr__(self) -> str:
        return f"<Ticket id={self.id} estado={self.estado} prioridad={self.prioridad}>"
