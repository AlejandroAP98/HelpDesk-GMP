"""Schemas del dominio TareaPendiente."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import DatetimeUTC


class TareaPendienteCreate(BaseModel):
    texto: str = Field(..., min_length=1, max_length=500)
    ticket_id: UUID | None = None


class TareaPendienteUpdate(BaseModel):
    texto: str | None = Field(None, min_length=1, max_length=500)
    completada: bool | None = None


class TareaPendienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    usuario_id: UUID
    texto: str
    completada: bool
    ticket_id: UUID | None = None
    ticket_titulo: str | None = None
    fecha_creacion: DatetimeUTC
    fecha_actualizacion: DatetimeUTC
