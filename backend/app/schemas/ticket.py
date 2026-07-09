"""Schemas del dominio Ticket."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EstadoTicket, PrioridadTicket


class TicketCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=150)
    descripcion: str = Field(..., min_length=1)
    categoria_id: int = Field(..., ge=1)
    prioridad: PrioridadTicket = PrioridadTicket.media


class TicketUpdate(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=150)
    descripcion: str | None = None
    categoria_id: int | None = Field(None, ge=1)
    prioridad: PrioridadTicket | None = None


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
    titulo: str
    descripcion: str
    estado: EstadoTicket
    prioridad: PrioridadTicket
    fecha_creacion: datetime
    fecha_actualizacion: datetime


class TicketDetalle(TicketOut):
    cliente_nombre: str | None = None
    agente_nombre: str | None = None
    modificado_por_nombre: str | None = None
    categoria_nombre: str | None = None
    empresa_nombre: str | None = None


class HistorialEstadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    usuario_id: UUID
    usuario_nombre: str | None = None
    estado_anterior: EstadoTicket
    estado_nuevo: EstadoTicket
    fecha: datetime