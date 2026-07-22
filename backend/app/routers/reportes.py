"""Endpoint de exportacion CSV de reportes de tickets."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, time
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.core.database import get_db
from app.core.deps import require_cliente, tenant_filter
from app.models.categoria import Categoria
from app.models.empresa import Empresa
from app.models.enums import EstadoTicket, PrioridadTicket
from app.models.historial_estado import HistorialEstado
from app.models.subcategoria import Subcategoria
from app.models.ticket import Ticket
from app.models.usuario import Usuario

router = APIRouter(prefix="/api/reportes", tags=["reportes"])

CSV_HEADER = [
    "id",
    "empresa",
    "categoria",
    "subcategoria",
    "elemento",
    "titulo",
    "descripcion",
    "asignado_a",
    "estado",
    "fecha_creacion",
    "fecha_asignacion",
    "fecha_primera_respuesta",
    "fecha_resolucion",
    "tiempo_resolucion_horas",
    "estados",
]


async def _cargar_historial(
    db: AsyncSession,
    ticket_ids: list,
) -> dict[str, str]:
    if not ticket_ids:
        return {}
    stmt_hist = (
        select(HistorialEstado)
        .where(HistorialEstado.ticket_id.in_(ticket_ids))
        .order_by(HistorialEstado.fecha)
    )
    result_hist = await db.execute(stmt_hist)
    historial_map: dict[str, list[str]] = {}
    for row in result_hist.scalars().all():
        key = str(row.ticket_id)
        entry = f"{row.estado_anterior.value}->{row.estado_nuevo.value} ({row.fecha.strftime('%Y-%m-%d %H:%M')})"
        historial_map.setdefault(key, []).append(entry)
    return {k: ", ".join(v) for k, v in historial_map.items()}


async def _generar_csv(
    db: AsyncSession,
    filtros: list,
) -> AsyncIterator[bytes]:
    buf = io.StringIO()
    writer = csv.writer(buf)

    buf.write("\ufeff")
    writer.writerow(CSV_HEADER)
    yield buf.getvalue().encode("utf-8")
    buf.truncate(0)
    buf.seek(0)

    stmt = (
        select(
            Ticket,
            Empresa.nombre.label("empresa_nombre"),
            Categoria.nombre.label("categoria_nombre"),
            Subcategoria.nombre.label("subcategoria_nombre"),
            Usuario.nombre.label("agente_nombre"),
        )
        .outerjoin(Empresa, Ticket.empresa_id == Empresa.id)
        .outerjoin(Categoria, Ticket.categoria_id == Categoria.id)
        .outerjoin(Subcategoria, Ticket.subcategoria_id == Subcategoria.id)
        .outerjoin(Usuario, Ticket.agente_id == Usuario.id)
        .where(*filtros)
        .order_by(Ticket.fecha_creacion)
    )
    result = await db.execute(stmt)

    for partition in result.partitions(500):
        ticket_ids = [str(r[0].id) for r in partition]
        historiales = await _cargar_historial(db, ticket_ids)

        for r in partition:
            ticket = r[0]
            empresa_nombre = r[1] or ""
            categoria_nombre = r[2] or ""
            subcategoria_nombre = r[3] or ""
            agente_nombre = r[4] or ""

            tiempo_horas: float | None = None
            if ticket.fecha_resolucion is not None and ticket.fecha_creacion is not None:
                delta = ticket.fecha_resolucion - ticket.fecha_creacion
                tiempo_horas = round(delta.total_seconds() / 3600, 2)

            writer.writerow(
                [
                    str(ticket.id),
                    empresa_nombre,
                    categoria_nombre,
                    subcategoria_nombre,
                    ticket.elemento_afectado.value,
                    ticket.titulo,
                    ticket.descripcion,
                    agente_nombre,
                    ticket.estado.value,
                    ticket.fecha_creacion.isoformat() if ticket.fecha_creacion else "",
                    ticket.fecha_asignacion.isoformat() if ticket.fecha_asignacion else "",
                    ticket.fecha_primera_respuesta.isoformat()
                    if ticket.fecha_primera_respuesta
                    else "",
                    ticket.fecha_resolucion.isoformat() if ticket.fecha_resolucion else "",
                    tiempo_horas if tiempo_horas is not None else "",
                    historiales.get(str(ticket.id), ""),
                ]
            )
            yield buf.getvalue().encode("utf-8")
            buf.truncate(0)
            buf.seek(0)


@router.get("/tickets/csv")
async def exportar_tickets_csv(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    estado: EstadoTicket | None = Query(None),
    prioridad: PrioridadTicket | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_cliente),
) -> StreamingResponse:
    filtros: list = []

    tf = tenant_filter(current)
    if "empresa_id" in tf:
        filtros.append(Ticket.empresa_id == tf["empresa_id"])
    elif empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    if fecha_inicio is not None:
        filtros.append(Ticket.fecha_creacion >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin is not None:
        filtros.append(Ticket.fecha_creacion <= datetime.combine(fecha_fin, time.max))
    if estado is not None:
        filtros.append(Ticket.estado == estado)
    if prioridad is not None:
        filtros.append(Ticket.prioridad == prioridad)

    if current.rol == "agente":
        filtros.append(Ticket.agente_id == current.id)

    hoy = date.today().isoformat()
    filename = f"reporte_tickets_{hoy}.csv"

    return StreamingResponse(
        _generar_csv(db, filtros),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
