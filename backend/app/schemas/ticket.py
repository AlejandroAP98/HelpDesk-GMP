"""Schemas del dominio Ticket."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EstadoTicket, ElementoInfraestructura, PrioridadTicket
from app.schemas import DatetimeUTC


class TicketCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=150)
    descripcion: str = Field(..., min_length=1, max_length=10000)
    categoria_id: int = Field(..., ge=1)
    subcategoria_id: int = Field(..., ge=1)
    elemento_afectado: ElementoInfraestructura
    ip_pcs: str | None = Field(None, max_length=255)
    ip_antena: str | None = Field(None, max_length=255)
    mascara_red: str | None = Field(None, max_length=255)
    puerta_enlace: str | None = Field(None, max_length=255)
    nombre_punto: str | None = Field(None, max_length=255)
    punto_venta_id: int | None = Field(None, ge=1)


class TicketAdminCreate(TicketCreate):
    """Creacion de tickets por admin/mesa_ayuda a nombre de un cliente.

    El staff elige la empresa y el cliente (de esa empresa) en cuyo nombre
    se registra el ticket (ej. reporte recibido por telefono/WhatsApp)."""

    empresa_id: int = Field(..., ge=1)
    cliente_id: UUID


class TicketUpdate(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=150)
    descripcion: str | None = Field(None, min_length=1, max_length=10000)
    categoria_id: int | None = Field(None, ge=1)
    prioridad: PrioridadTicket | None = None
    ip_pcs: str | None = Field(None, max_length=255)
    ip_antena: str | None = Field(None, max_length=255)
    mascara_red: str | None = Field(None, max_length=255)
    puerta_enlace: str | None = Field(None, max_length=255)
    nombre_punto: str | None = Field(None, max_length=255)


class EstadoUpdate(BaseModel):
    estado: EstadoTicket


class AsignacionRequest(BaseModel):
    agente_id: UUID


class PrioridadUpdate(BaseModel):
    prioridad: PrioridadTicket


class PausaRequest(BaseModel):
    motivo: str = Field(..., min_length=3, max_length=500)


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    empresa_id: int
    empresa_nombre: str | None = None
    cliente_id: UUID
    cliente_nombre: str | None = None
    agente_id: UUID | None
    agente_nombre: str | None = None
    modificado_por_id: UUID | None = None
    categoria_id: int
    subcategoria_id: int
    elemento_afectado: ElementoInfraestructura
    titulo: str
    descripcion: str
    ip_pcs: str | None = None
    ip_antena: str | None = None
    mascara_red: str | None = None
    puerta_enlace: str | None = None
    nombre_punto: str | None = None
    punto_venta_id: int | None = None
    estado: EstadoTicket
    prioridad: PrioridadTicket
    fecha_creacion: DatetimeUTC
    fecha_actualizacion: DatetimeUTC
    fecha_asignacion: DatetimeUTC | None = None
    fecha_primera_respuesta: DatetimeUTC | None = None
    fecha_resolucion: DatetimeUTC | None = None
    en_pausa: bool = False
    motivo_pausa: str | None = None
    fecha_pausa: DatetimeUTC | None = None
    segundos_pausa_acumulado: int = 0


class TicketDetalle(TicketOut):
    cliente_nombre: str | None = None
    agente_nombre: str | None = None
    modificado_por_nombre: str | None = None
    categoria_nombre: str | None = None
    subcategoria_nombre: str | None = None
    empresa_nombre: str | None = None


class HistorialEstadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    usuario_id: UUID
    usuario_nombre: str | None = None
    estado_anterior: EstadoTicket
    estado_nuevo: EstadoTicket
    fecha: DatetimeUTC
