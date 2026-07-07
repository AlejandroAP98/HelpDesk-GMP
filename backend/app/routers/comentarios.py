"""Endpoints REST de Comentarios."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usuario import Usuario
from app.schemas.comentario import ComentarioCreate, ComentarioOut
from app.services import comentario_service

router = APIRouter(prefix="/api/tickets/{ticket_id}/comentarios", tags=["comentarios"])


@router.get("", response_model=list[ComentarioOut])
async def listar(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> list[ComentarioOut]:
    return await comentario_service.listar(ticket_id, current, db)


@router.post("", response_model=ComentarioOut, status_code=status.HTTP_201_CREATED)
async def crear(
    ticket_id: UUID,
    data: ComentarioCreate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> ComentarioOut:
    return await comentario_service.crear(ticket_id, data, current, db)