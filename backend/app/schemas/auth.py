"""Schemas de autenticacion."""
from pydantic import BaseModel, EmailStr, Field

from app.models.enums import RolUsuario
from app.schemas.usuario import Token, UsuarioOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RegistroRequest(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    empresa_id: int = Field(..., ge=1)


class RegistroAgenteRequest(BaseModel):
    """Uso interno de admins: crea agente/admin sin empresa."""

    nombre: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    rol: RolUsuario = RolUsuario.agente
    empresa_id: int | None = None


class CambiarPasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


__all__ = ["LoginRequest", "RegistroRequest", "RegistroAgenteRequest", "CambiarPasswordRequest", "Token", "UsuarioOut"]