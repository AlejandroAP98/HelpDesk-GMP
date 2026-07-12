"""Schemas del dominio Adjunto."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas import DatetimeUTC


class AdjuntoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    comentario_id: UUID | None
    archivo_url: str
    nombre_archivo: str
    tipo_mime: str | None
    tamano_bytes: int | None
    fecha_creacion: DatetimeUTC


class AdjuntoUploadResponse(BaseModel):
    id: UUID
    archivo_url: str
    nombre_archivo: str
    tamano_bytes: int | None
    tipo_mime: str | None