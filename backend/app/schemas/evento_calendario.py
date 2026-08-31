"""Schemas del dominio EventoCalendario."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import DatetimeUTC


class EventoCalendarioCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=200)
    descripcion: str | None = None
    fecha_inicio: DatetimeUTC
    fecha_fin: DatetimeUTC
    recordar_email: bool = False
    minutos_antes: int = Field(default=15, ge=5, le=1440)
    ticket_id: UUID | None = None


class EventoCalendarioUpdate(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=200)
    descripcion: str | None = None
    fecha_inicio: DatetimeUTC | None = None
    fecha_fin: DatetimeUTC | None = None
    recordar_email: bool | None = None
    minutos_antes: int | None = Field(None, ge=5, le=1440)
    ticket_id: UUID | None = None


class EventoCalendarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    usuario_id: UUID
    ticket_id: UUID | None = None
    titulo: str
    descripcion: str | None = None
    fecha_inicio: DatetimeUTC
    fecha_fin: DatetimeUTC
    recordar_email: bool
    minutos_antes: int
    email_enviado: bool
    fecha_creacion: DatetimeUTC
