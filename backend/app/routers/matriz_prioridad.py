"""Endpoints CRUD de Matriz de Prioridad.

- GET (listar por categoria): cualquier usuario autenticado.
- POST/PATCH/DELETE/bulk: solo admin.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.usuario import Usuario
from app.schemas.matriz_prioridad import (
    MatrizPrioridadBulk,
    MatrizPrioridadCreate,
    MatrizPrioridadOut,
    MatrizPrioridadUpdate,
)
from app.schemas.usuario import Mensaje
from app.services import matriz_prioridad_service

router = APIRouter(prefix="/api/matriz-prioridad", tags=["matriz-prioridad"])


@router.get("/por-categoria/{categoria_id}", response_model=list[MatrizPrioridadOut])
async def listar_por_categoria(
    categoria_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> list[MatrizPrioridadOut]:
    items = await matriz_prioridad_service.listar_por_categoria(categoria_id, db)
    return [MatrizPrioridadOut.model_validate(i) for i in items]


@router.post("", response_model=MatrizPrioridadOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: MatrizPrioridadCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> MatrizPrioridadOut:
    item = await matriz_prioridad_service.crear(data, db)
    return MatrizPrioridadOut.model_validate(item)


@router.patch("/{item_id}", response_model=MatrizPrioridadOut)
async def actualizar(
    item_id: int,
    data: MatrizPrioridadUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> MatrizPrioridadOut:
    item = await matriz_prioridad_service.actualizar_prioridad(
        item_id, data.prioridad, db
    )
    return MatrizPrioridadOut.model_validate(item)


@router.delete("/{item_id}", response_model=Mensaje)
async def eliminar(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> Mensaje:
    await matriz_prioridad_service.eliminar(item_id, db)
    return Mensaje(detail=f"Entrada de matriz {item_id} eliminada")


@router.put(
    "/categoria/{categoria_id}",
    response_model=list[MatrizPrioridadOut],
    status_code=status.HTTP_200_OK,
)
async def sincronizar_categoria(
    categoria_id: int,
    data: MatrizPrioridadBulk,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> list[MatrizPrioridadOut]:
    items = await matriz_prioridad_service.sincronizar_categoria(
        categoria_id, data, db
    )
    return [MatrizPrioridadOut.model_validate(i) for i in items]
