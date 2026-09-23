"""Endpoints REST de Tareas Pendientes (checklist interno)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_agente
from app.models.usuario import Usuario
from app.schemas.tarea_pendiente import (
    TareaPendienteCreate,
    TareaPendienteOut,
    TareaPendienteUpdate,
)
from app.services import tarea_pendiente_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/tareas", tags=["tareas"])


@router.get("", response_model=Pagina[TareaPendienteOut])
async def listar(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    completada: bool | None = Query(None),
    ticket_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> Pagina[TareaPendienteOut]:
    return await tarea_pendiente_service.listar(
        current, db, page=page, size=size, completada=completada, ticket_id=ticket_id
    )


@router.post("", response_model=TareaPendienteOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: TareaPendienteCreate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> TareaPendienteOut:
    return await tarea_pendiente_service.crear(data, current, db)


@router.patch("/{tarea_id}", response_model=TareaPendienteOut)
async def actualizar(
    tarea_id: UUID,
    data: TareaPendienteUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> TareaPendienteOut:
    return await tarea_pendiente_service.actualizar(tarea_id, data, current, db)


@router.delete("/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def eliminar(
    tarea_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> None:
    await tarea_pendiente_service.eliminar(tarea_id, current, db)
