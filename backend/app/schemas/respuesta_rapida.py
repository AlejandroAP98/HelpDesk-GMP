from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import DatetimeUTC


class RespuestaRapidaCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=100)
    contenido: str = Field(..., min_length=1)


class RespuestaRapidaUpdate(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=100)
    contenido: str | None = Field(None, min_length=1)


class RespuestaRapidaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    usuario_id: UUID
    titulo: str
    contenido: str
    fecha_creacion: DatetimeUTC
    fecha_actualizacion: DatetimeUTC
