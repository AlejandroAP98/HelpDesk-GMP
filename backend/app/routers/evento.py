"""Endpoints REST de Eventos de Calendario."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_mesa_ayuda
from app.models.usuario import Usuario
from app.schemas.evento_calendario import (
    EventoCalendarioCreate,
    EventoCalendarioOut,
    EventoCalendarioUpdate,
)
from app.services import evento_service

router = APIRouter(prefix="/api/eventos", tags=["eventos"])


@router.get("", response_model=list[EventoCalendarioOut])
async def listar(
    fecha_inicio: datetime | None = Query(None),
    fecha_fin: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> list[EventoCalendarioOut]:
    """Lista eventos del usuario actual, opcionalmente filtrados por rango de fechas."""
    return await evento_service.listar(
        current, db, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin
    )


@router.post("", response_model=EventoCalendarioOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: EventoCalendarioCreate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> EventoCalendarioOut:
    """Crea un nuevo evento de calendario."""
    return await evento_service.crear(data, current, db)


@router.patch("/{evento_id}", response_model=EventoCalendarioOut)
async def actualizar(
    evento_id: UUID,
    data: EventoCalendarioUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> EventoCalendarioOut:
    """Actualiza un evento existente."""
    return await evento_service.actualizar(evento_id, data, current, db)


@router.delete("/{evento_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def eliminar(
    evento_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> None:
    """Elimina un evento."""
    await evento_service.eliminar(evento_id, current, db)
