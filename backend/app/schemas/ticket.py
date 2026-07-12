"""Schemas del dominio Ticket."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EstadoTicket, ElementoInfraestructura, PrioridadTicket
from app.schemas import DatetimeUTC


class TicketCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=150)
    descripcion: str = Field(..., min_length=1)
    categoria_id: int = Field(..., ge=1)
    subcategoria_id: int = Field(..., ge=1)
    elemento_afectado: ElementoInfraestructura
    ip_pcs: str | None = None
    ip_antena: str | None = None
    mascara_red: str | None = None
    puerta_enlace: str | None = None
    nombre_punto: str | None = None


class TicketUpdate(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=150)
    descripcion: str | None = None
    categoria_id: int | None = Field(None, ge=1)
    prioridad: PrioridadTicket | None = None
    ip_pcs: str | None = None
    ip_antena: str | None = None
    mascara_red: str | None = None
    puerta_enlace: str | None = None
    nombre_punto: str | None = None


class EstadoUpdate(BaseModel):
    estado: EstadoTicket


class AsignacionRequest(BaseModel):
    agente_id: UUID


class PrioridadUpdate(BaseModel):
    prioridad: PrioridadTicket


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    empresa_id: int
    cliente_id: UUID
    agente_id: UUID | None
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
    estado: EstadoTicket
    prioridad: PrioridadTicket
    fecha_creacion: DatetimeUTC
    fecha_actualizacion: DatetimeUTC


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