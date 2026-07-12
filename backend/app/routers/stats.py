"""Endpoint de estadisticas para el dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, tenant_filter
from app.models.enums import EstadoTicket, PrioridadTicket, RolUsuario
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.stats import StatsOut

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
async def obtener_stats(
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> StatsOut:
    base = select(func.count(Ticket.id))
    tf = tenant_filter(current)
    if "empresa_id" in tf:
        base = base.where(Ticket.empresa_id == tf["empresa_id"])
    if current.rol == RolUsuario.agente.value:
        base = base.where(Ticket.agente_id == current.id)

    total = (await db.execute(base)).scalar_one()
    abiertos = (await db.execute(base.where(Ticket.estado == EstadoTicket.abierto))).scalar_one()
    asignados = (await db.execute(base.where(Ticket.estado == EstadoTicket.asignado))).scalar_one()
    en_progreso = (await db.execute(base.where(Ticket.estado == EstadoTicket.en_progreso))).scalar_one()
    resueltos = (await db.execute(base.where(Ticket.estado == EstadoTicket.resuelto))).scalar_one()
    cerrados = (await db.execute(base.where(Ticket.estado == EstadoTicket.cerrado))).scalar_one()
    urgentes = (await db.execute(base.where(Ticket.prioridad == PrioridadTicket.urgente))).scalar_one()

    return StatsOut(
        total=total,
        abiertos=abiertos,
        asignados=asignados,
        en_progreso=en_progreso,
        resueltos=resueltos,
        cerrados=cerrados,
        urgentes=urgentes,
    )
