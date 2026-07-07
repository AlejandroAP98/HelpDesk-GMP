"""Endpoints CRUD de Categorias.

- GET (listar y obtener): cualquier usuario autenticado.
- POST/PATCH/DELETE: solo admin.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.usuario import Usuario
from app.schemas.categoria import CategoriaCreate, CategoriaOut, CategoriaUpdate
from app.schemas.usuario import Mensaje
from app.services import categoria_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


@router.get("", response_model=list[CategoriaOut])
async def listar(
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> list[CategoriaOut]:
    items = await categoria_service.listar_sin_paginar(db)
    return [CategoriaOut.model_validate(c) for c in items]


@router.get("/{categoria_id}", response_model=CategoriaOut)
async def obtener(
    categoria_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> CategoriaOut:
    categoria = await categoria_service.obtener(categoria_id, db)
    return CategoriaOut.model_validate(categoria)


@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: CategoriaCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> CategoriaOut:
    categoria = await categoria_service.crear(data, db)
    return CategoriaOut.model_validate(categoria)


@router.patch("/{categoria_id}", response_model=CategoriaOut)
async def actualizar(
    categoria_id: int,
    data: CategoriaUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> CategoriaOut:
    categoria = await categoria_service.actualizar(categoria_id, data, db)
    return CategoriaOut.model_validate(categoria)


@router.delete("/{categoria_id}", response_model=Mensaje)
async def eliminar(
    categoria_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> Mensaje:
    await categoria_service.eliminar(categoria_id, db)
    return Mensaje(detail=f"Categoria {categoria_id} eliminada")