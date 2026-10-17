"""Schemas del dominio Comentario."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import DatetimeUTC
from app.schemas.adjunto import AdjuntoOut


class ComentarioCreate(BaseModel):
    contenido: str | None = Field(default=None, max_length=5000)
    es_nota_interna: bool = False


class ComentarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    usuario_id: UUID
    usuario_nombre: str | None = None
    contenido: str | None
    es_nota_interna: bool
    fecha_creacion: DatetimeUTC
    adjuntos: list[AdjuntoOut] = []