"""Schemas del dominio Comentario."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import DatetimeUTC


class ComentarioCreate(BaseModel):
    contenido: str = Field(..., min_length=1)
    es_nota_interna: bool = False


class ComentarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    usuario_id: UUID
    usuario_nombre: str | None = None
    contenido: str
    es_nota_interna: bool
    fecha_creacion: DatetimeUTC