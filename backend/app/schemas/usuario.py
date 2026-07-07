"""Schemas Pydantic para el dominio Usuario."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import RolUsuario


class UsuarioBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    rol: RolUsuario = RolUsuario.cliente
    empresa_id: int | None = None


class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=8, max_length=128)


class UsuarioRegistroCliente(UsuarioBase):
    """Registro publico: solo clientes, sempre con empresa_id."""

    nombre: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    rol: RolUsuario = RolUsuario.cliente  # forzado para clientes publicos
    empresa_id: int = Field(..., ge=1)    # obligatorio para cliente


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    email: EmailStr
    rol: RolUsuario
    empresa_id: int | None
    fecha_creacion: datetime


class UsuarioConEmpresa(UsuarioOut):
    empresa_nombre: str | None = None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    usuario: "UsuarioOut"


class RefreshRequest(BaseModel):
    refresh_token: str


class Mensaje(BaseModel):
    detail: str


class UsuarioUpdateByAdmin(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=100)
    email: EmailStr | None = None
    rol: RolUsuario | None = None
    empresa_id: int | None = None
    password: str | None = Field(None, min_length=8, max_length=128)


from app.schemas.usuario import UsuarioOut  # noqa: E402,F811 (ref forward)
Token.model_rebuild()