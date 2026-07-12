"""Endpoints REST de Adjuntos (subida a MinIO)."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usuario import Usuario
from app.schemas.adjunto import AdjuntoOut
from app.schemas.usuario import Mensaje
from app.services import adjunto_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/tickets/{ticket_id}/adjuntos", tags=["adjuntos"])


@router.get("", response_model=Pagina[AdjuntoOut])
async def listar(
    ticket_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> Pagina[AdjuntoOut]:
    return await adjunto_service.listar(ticket_id, current, db, page=page, size=size)


@router.post("", response_model=AdjuntoOut, status_code=status.HTTP_201_CREATED)
async def subir(
    ticket_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> AdjuntoOut:
    data = await file.read()
    return await adjunto_service.subir(
        ticket_id=ticket_id,
        file_name=file.filename or "archivo",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        current=current,
        db=db,
    )


@router.delete("/{adjunto_id}", response_model=Mensaje)
async def eliminar(
    ticket_id: UUID,
    adjunto_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> Mensaje:
    await adjunto_service.eliminar(adjunto_id, current, db)
    return Mensaje(detail=f"Adjunto {adjunto_id} eliminado")