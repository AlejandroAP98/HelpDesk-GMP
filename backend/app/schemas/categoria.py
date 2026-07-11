"""Schemas del dominio Categoria y Subcategoria."""
from pydantic import BaseModel, ConfigDict, Field


class CategoriaBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=50)
    descripcion: str | None = None


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=50)
    descripcion: str | None = None


class CategoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: str | None


class SubcategoriaBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    descripcion: str | None = None


class SubcategoriaCreate(SubcategoriaBase):
    categoria_id: int = Field(..., ge=1)


class SubcategoriaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=80)
    descripcion: str | None = None


class SubcategoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    categoria_id: int
    nombre: str
    descripcion: str | None