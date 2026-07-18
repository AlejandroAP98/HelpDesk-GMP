"""Schemas del dominio MatrizPrioridad."""
from pydantic import BaseModel, ConfigDict, Field


class MatrizPrioridadCreate(BaseModel):
    categoria_id: int = Field(..., ge=1)
    subcategoria_id: int = Field(..., ge=1)
    elemento: str = Field(..., pattern=r"^(torre|celda|mastil|punto_venta)$")
    prioridad: str = Field(..., pattern=r"^(baja|media|alta|urgente)$")


class MatrizPrioridadUpdate(BaseModel):
    prioridad: str = Field(..., pattern=r"^(baja|media|alta|urgente)$")


class MatrizPrioridadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    categoria_id: int
    subcategoria_id: int
    elemento: str
    prioridad: str


class MatrizPrioridadBulkItem(BaseModel):
    subcategoria_id: int = Field(..., ge=1)
    elemento: str = Field(..., pattern=r"^(torre|celda|mastil|punto_venta)$")
    prioridad: str = Field(..., pattern=r"^(baja|media|alta|urgente)$")


class MatrizPrioridadBulk(BaseModel):
    items: list[MatrizPrioridadBulkItem]
