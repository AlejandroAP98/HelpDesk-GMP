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


def _base_filters(current: Usuario):
    """Construye los filtros WHERE base (tenant + agente) reutilizables."""
    conditions = []
    tf = tenant_filter(current)
    if "empresa_id" in tf:
        conditions.append(Ticket.empresa_id == tf["empresa_id"])
    if current.rol == RolUsuario.agente.value:
        conditions.append(Ticket.agente_id == current.id)
    return conditions


@router.get("", response_model=StatsOut)
async def obtener_stats(
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> StatsOut:
    conditions = _base_filters(current)

    group_stmt = select(Ticket.estado, func.count(Ticket.id))
    for cond in conditions:
        group_stmt = group_stmt.where(cond)
    group_stmt = group_stmt.group_by(Ticket.estado)
    rows = (await db.execute(group_stmt)).all()
    by_estado: dict[str, int] = {row[0].value if hasattr(row[0], "value") else row[0]: row[1] for row in rows}

    total = sum(by_estado.values())

    urgent_stmt = select(func.count(Ticket.id)).where(
        Ticket.prioridad == PrioridadTicket.urgente,
        Ticket.estado != EstadoTicket.resuelto,
        Ticket.estado != EstadoTicket.cerrado,
    )
    for cond in conditions:
        urgent_stmt = urgent_stmt.where(cond)
    urgentes = (await db.execute(urgent_stmt)).scalar_one()

    return StatsOut(
        total=total,
        abiertos=by_estado.get("abierto", 0),
        asignados=by_estado.get("asignado", 0),
        en_progreso=by_estado.get("en_progreso", 0),
        resueltos=by_estado.get("resuelto", 0),
        cerrados=by_estado.get("cerrado", 0),
        urgentes=urgentes,
    )