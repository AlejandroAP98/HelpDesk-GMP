"""Esquema del principal autenticado (claims del JWT decodificados)."""
from uuid import UUID

from pydantic import BaseModel


class Principal(BaseModel):
    """Identidad extraida del JWT de acceso."""

    sub: str               # UUID del usuario (como string)
    usuario_id: UUID
    empresa_id: int | None
    rol: str
    type: str = "access"