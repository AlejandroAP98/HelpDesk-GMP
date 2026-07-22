"""Dependencias de FastAPI: auth, RBAC y aislamiento multi-tenant."""
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.schemas.principal import Principal
from app.utils.exceptions import PermisoDenegado, TokenInvalido

bearer_scheme = HTTPBearer(auto_error=False)


async def get_principal(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Principal:
    """Extrae y valida el JWT de acceso desde el header Authorization: Bearer ..."""
    if creds is None or creds.scheme.lower() != "bearer":
        raise TokenInvalido("Falta header Authorization Bearer")
    try:
        payload = decode_access_token(creds.credentials)
    except Exception as exc:
        raise TokenInvalido() from exc
    try:
        return Principal(
            sub=payload["sub"],
            usuario_id=payload["usuario_id"],
            empresa_id=payload.get("empresa_id"),
            rol=payload["rol"],
            type=payload["type"],
        )
    except (KeyError, ValueError) as exc:
        raise TokenInvalido("Claims incompletos") from exc


async def get_current_user(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Usuario:
    """Resuelve el Principal a una instancia Usuario de la DB."""
    result = await db.execute(select(Usuario).where(Usuario.id == principal.usuario_id))
    usuario = result.scalar_one_or_none()
    if usuario is None:
        raise TokenInvalido("Usuario inexistente")
    return usuario


def require_roles(*roles: RolUsuario):
    """Factory de dependencia: exige que el usuario tenga uno de los roles indicados."""

    async def _check(
        current: Annotated[Usuario, Depends(get_current_user)],
    ) -> Usuario:
        if current.rol not in (r.value for r in roles):
            raise PermisoDenegado(f"Rol requerido: {', '.join(r.value for r in roles)}")
        return current

    return _check


require_admin = require_roles(RolUsuario.administrador)
require_agente = require_roles(RolUsuario.agente, RolUsuario.administrador, RolUsuario.mesa_ayuda)
require_mesa_ayuda = require_roles(
    RolUsuario.mesa_ayuda, RolUsuario.administrador
)
require_cliente = require_roles(
    RolUsuario.cliente, RolUsuario.agente, RolUsuario.mesa_ayuda, RolUsuario.administrador
)


def tenant_filter(usuario: Usuario) -> dict:
    """Devuelve filtros para queries multi-tenant.

    - cliente: solo ve recursos de su propia empresa.
    - agente/mesa_ayuda/admin: ve recursos de cualquier empresa (sin filtro).
    """
    if usuario.rol == RolUsuario.cliente.value and usuario.empresa_id is not None:
        return {"empresa_id": usuario.empresa_id}
    return {}