from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_agente
from app.models.usuario import Usuario
from app.schemas.respuesta_rapida import (
    RespuestaRapidaCreate,
    RespuestaRapidaOut,
    RespuestaRapidaUpdate,
)
from app.services import respuesta_rapida_service

router = APIRouter(prefix="/api/respuestas-rapidas", tags=["respuestas_rapidas"])


@router.get("", response_model=list[RespuestaRapidaOut])
async def listar(
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> list[RespuestaRapidaOut]:
    return await respuesta_rapida_service.listar(current, db)


@router.post("", response_model=RespuestaRapidaOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: RespuestaRapidaCreate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> RespuestaRapidaOut:
    return await respuesta_rapida_service.crear(data, current, db)


@router.put("/{rr_id}", response_model=RespuestaRapidaOut)
async def actualizar(
    rr_id: UUID,
    data: RespuestaRapidaUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> RespuestaRapidaOut:
    return await respuesta_rapida_service.actualizar(rr_id, data, current, db)


@router.delete("/{rr_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def eliminar(
    rr_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_agente),
) -> None:
    await respuesta_rapida_service.eliminar(rr_id, current, db)
