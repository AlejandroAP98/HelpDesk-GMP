"""Schemas del dominio Empresa."""
from pydantic import BaseModel, ConfigDict, Field

from app.schemas import DatetimeUTC


class EmpresaBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)


class EmpresaCreate(EmpresaBase):
    pass


class EmpresaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=100)


class EmpresaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    fecha_creacion: DatetimeUTC