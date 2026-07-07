"""Servicio de autenticacion: registro, login, refresh."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.empresa import Empresa
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, RegistroAgenteRequest, RegistroRequest
from app.schemas.usuario import Token, UsuarioOut
from app.utils.exceptions import Conflicto, CredencialesInvalidas, RecursoNoEncontrado, TokenInvalido


async def _issue_tokens(usuario: Usuario) -> Token:
    extra: dict[str, Any] = {
        "usuario_id": str(usuario.id),
        "rol": usuario.rol.value if hasattr(usuario.rol, "value") else usuario.rol,
        "empresa_id": usuario.empresa_id,
    }
    access = create_access_token(sub=str(usuario.id), extra=extra)
    refresh = create_refresh_token(sub=str(usuario.id))
    return Token(
        access_token=access,
        refresh_token=refresh,
        usuario=UsuarioOut.model_validate(usuario),
    )


async def registrar_cliente(data: RegistroRequest, db: AsyncSession) -> Token:
    empresa = (
        await db.execute(select(Empresa).where(Empresa.id == data.empresa_id))
    ).scalar_one_or_none()
    if empresa is None:
        raise RecursoNoEncontrado(f"Empresa {data.empresa_id} no existe")

    existente = (
        await db.execute(select(Usuario).where(Usuario.email == data.email))
    ).scalar_one_or_none()
    if existente is not None:
        raise Conflicto("Email ya registrado")

    usuario = Usuario(
        nombre=data.nombre,
        email=data.email,
        password_hash=hash_password(data.password),
        rol=RolUsuario.cliente,
        empresa_id=data.empresa_id,
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    return await _issue_tokens(usuario)


async def registrar_interno(
    data: RegistroAgenteRequest, db: AsyncSession
) -> UsuarioOut:
    """Crea agente/admin. Solo admins. No emite tokens (el admin ya los tiene)."""
    if data.rol == RolUsuario.cliente:
        raise Conflicto("Use el endpoint publico para registrar clientes")
    if data.empresa_id is not None:
        empresa = (
            await db.execute(select(Empresa).where(Empresa.id == data.empresa_id))
        ).scalar_one_or_none()
        if empresa is None:
            raise RecursoNoEncontrado(f"Empresa {data.empresa_id} no existe")

    existente = (
        await db.execute(select(Usuario).where(Usuario.email == data.email))
    ).scalar_one_or_none()
    if existente is not None:
        raise Conflicto("Email ya registrado")

    usuario = Usuario(
        nombre=data.nombre,
        email=data.email,
        password_hash=hash_password(data.password),
        rol=data.rol,
        empresa_id=data.empresa_id,
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    return UsuarioOut.model_validate(usuario)


async def login(data: LoginRequest, db: AsyncSession) -> Token:
    usuario = (
        await db.execute(select(Usuario).where(Usuario.email == data.email))
    ).scalar_one_or_none()
    if usuario is None or not verify_password(data.password, usuario.password_hash):
        raise CredencialesInvalidas()
    return await _issue_tokens(usuario)


async def refresh(refresh_token: str, db: AsyncSession) -> Token:
    try:
        payload = decode_refresh_token(refresh_token)
    except Exception as exc:
        raise TokenInvalido() from exc
    usuario_id = payload.get("sub")
    if not usuario_id:
        raise TokenInvalido()
    usuario = (
        await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    ).scalar_one_or_none()
    if usuario is None:
        raise TokenInvalido("Usuario inexistente")
    return await _issue_tokens(usuario)