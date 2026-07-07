"""Endpoints CRUD de Usuarios (admin).

- GET: listar y obtener (solo admin).
- PATCH: actualizar (solo admin).
- DELETE: eliminar (solo admin).
La creacion de usuarios se hace via /api/auth/register (cliente) o
/api/auth/register/agente (agente/admin), no aca.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.schemas.usuario import Mensaje, UsuarioOut, UsuarioUpdateByAdmin
from app.services import usuario_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


@router.get("", response_model=Pagina[UsuarioOut])
async def listar(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    rol: RolUsuario | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> Pagina[UsuarioOut]:
    return await usuario_service.listar(
        page=page, size=size, rol=rol, empresa_id=empresa_id, db=db
    )


@router.get("/{usuario_id}", response_model=UsuarioOut)
async def obtener(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> UsuarioOut:
    usuario = await usuario_service.obtener(usuario_id, db)
    return UsuarioOut.model_validate(usuario)


@router.patch("/{usuario_id}", response_model=UsuarioOut)
async def actualizar(
    usuario_id: UUID,
    data: UsuarioUpdateByAdmin,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> UsuarioOut:
    usuario = await usuario_service.actualizar(usuario_id, data, db)
    return UsuarioOut.model_validate(usuario)


@router.delete("/{usuario_id}", response_model=Mensaje)
async def eliminar(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> Mensaje:
    await usuario_service.eliminar(usuario_id, db)
    return Mensaje(detail=f"Usuario {usuario_id} eliminado")