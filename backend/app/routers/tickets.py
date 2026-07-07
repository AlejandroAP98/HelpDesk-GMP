"""Endpoints REST de Tickets."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.enums import EstadoTicket, PrioridadTicket
from app.models.usuario import Usuario
from app.schemas.ticket import (
    AsignacionRequest,
    EstadoUpdate,
    PrioridadUpdate,
    TicketCreate,
    TicketOut,
    TicketUpdate,
)
from app.schemas.usuario import Mensaje
from app.services import ticket_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("", response_model=Pagina[TicketOut])
async def listar(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    estado: EstadoTicket | None = Query(None),
    prioridad: PrioridadTicket | None = Query(None),
    empresa_id: int | None = Query(None),
    agente_id: UUID | None = Query(None),
    cliente_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> Pagina[TicketOut]:
    pagina = await ticket_service.listar(
        current=current, db=db, page=page, size=size, estado=estado,
        prioridad=prioridad, empresa_id=empresa_id,
        agente_id=agente_id, cliente_id=cliente_id,
    )
    return Pagina.of(
        [TicketOut.model_validate(t) for t in pagina.items],
        pagina.total, pagina.page, pagina.size,
    )


@router.get("/{ticket_id}", response_model=TicketOut)
async def obtener(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.obtener(ticket_id, current, db)
    return TicketOut.model_validate(ticket)


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.crear(data, current, db)
    return TicketOut.model_validate(ticket)


@router.patch("/{ticket_id}", response_model=TicketOut)
async def actualizar(
    ticket_id: UUID,
    data: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.actualizar(ticket_id, data, current, db)
    return TicketOut.model_validate(ticket)


@router.post("/{ticket_id}/asignar", response_model=TicketOut)
async def asignar(
    ticket_id: UUID,
    data: AsignacionRequest,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_admin),
) -> TicketOut:
    ticket = await ticket_service.asignar(ticket_id, data, current, db)
    return TicketOut.model_validate(ticket)


@router.patch("/{ticket_id}/estado", response_model=TicketOut)
async def cambiar_estado(
    ticket_id: UUID,
    data: EstadoUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.cambiar_estado(ticket_id, data, current, db)
    return TicketOut.model_validate(ticket)


@router.patch("/{ticket_id}/prioridad", response_model=TicketOut)
async def cambiar_prioridad(
    ticket_id: UUID,
    data: PrioridadUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.cambiar_prioridad(ticket_id, data, current, db)
    return TicketOut.model_validate(ticket)


@router.post("/{ticket_id}/cerrar", response_model=TicketOut)
async def cerrar(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.cambiar_estado(
        ticket_id, EstadoUpdate(estado=EstadoTicket.cerrado), current, db
    )
    return TicketOut.model_validate(ticket)


@router.post("/{ticket_id}/reabrir", response_model=TicketOut)
async def reabrir(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_admin),
) -> TicketOut:
    ticket = await ticket_service.reabrir(ticket_id, current, db)
    return TicketOut.model_validate(ticket)