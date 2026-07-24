"""Schemas del dominio PuntoVenta."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PuntoVentaCreate(BaseModel):
    empresa_id: int = Field(..., ge=1)
    nombre: str = Field(..., min_length=1, max_length=255)
    direccion: str | None = None
    ciudad: str | None = None


class PuntoVentaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=255)
    direccion: str | None = None
    ciudad: str | None = None
    activo: bool | None = None


class PuntoVentaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    empresa_id: int
    empresa_nombre: str | None = None
    nombre: str
    direccion: str | None = None
    ciudad: str | None = None
    activo: bool
