"""Endpoints REST de autenticacion."""
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.rate_limit import enforce_rate_limit
from app.models.usuario import Usuario
from app.schemas.auth import (
    CambiarPasswordRequest,
    LoginRequest,
    RegistroAgenteRequest,
    RegistroRequest,
)
from app.schemas.usuario import Mensaje, PreferenciasNotificacion, RefreshRequest, Token, UsuarioOut
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def registrar_cliente(
    data: RegistroRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Registro publico de clientes. Crea usuario con rol 'cliente' vinculado a empresa."""
    ip = request.client.host if request.client else "desconocida"
    await enforce_rate_limit(
        f"helpdesk:rl:register:{ip}", max_intentos=10, ventana_segundos=3600,
        mensaje="Demasiados registros desde esta IP. Intentalo mas tarde.",
    )
    return await auth_service.registrar_cliente(data, db)


@router.post("/register/agente", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def registrar_interno(
    data: RegistroAgenteRequest,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> UsuarioOut:
    """Crea agente/admin. Solo admins."""
    return await auth_service.registrar_interno(data, db)


@router.post("/login", response_model=Token)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> Token:
    ip = request.client.host if request.client else "desconocida"
    await enforce_rate_limit(
        f"helpdesk:rl:login:{ip}:{data.email.lower()}",
        max_intentos=10,
        ventana_segundos=900,
        mensaje="Demasiados intentos de inicio de sesion. Espera 15 minutos.",
    )
    return await auth_service.login(data, db)


@router.post("/refresh", response_model=Token)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)) -> Token:
    return await auth_service.refresh(data.refresh_token, db)


@router.get("/me", response_model=UsuarioOut)
async def me(current: Annotated[Usuario, Depends(get_current_user)]) -> UsuarioOut:
    return UsuarioOut.model_validate(current)


@router.patch("/preferences", response_model=UsuarioOut)
async def actualizar_preferencias(
    data: PreferenciasNotificacion,
    current: Annotated[Usuario, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> UsuarioOut:
    current.notificaciones_email = data.notificaciones_email
    await db.commit()
    await db.refresh(current)
    return UsuarioOut.model_validate(current)


@router.post("/change-password", response_model=Mensaje)
async def cambiar_password(
    data: CambiarPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> Mensaje:
    return await auth_service.cambiar_password(data, current, db)


@router.post("/logout", response_model=Mensaje)
async def logout(
    current: Annotated[Usuario, Depends(get_current_user)],
    data: RefreshRequest | None = None,
) -> Mensaje:
    """Revoca el refresh token (blacklist Redis) si el cliente lo envia.
    El access token sigue valido hasta expirar (max 30 min)."""
    if data and data.refresh_token:
        await auth_service.revocar_refresh_token(data.refresh_token)
    return Mensaje(detail="Sesion cerrada. Elimine el token del cliente.")