"""Endpoint de exportacion CSV de reportes de tickets."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, time, timezone
from typing import AsyncIterator
from zoneinfo import ZoneInfo

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
from app.models.punto_venta import PuntoVenta
from app.models.subcategoria import Subcategoria
from app.models.ticket import Ticket
from app.models.usuario import Usuario

router = APIRouter(prefix="/api/reportes", tags=["reportes"])

UTC = ZoneInfo("UTC")
BOGOTA = ZoneInfo("America/Bogota")


def _a_bogota(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(BOGOTA)


CSV_HEADER = [
    "id",
    "empresa",
    "categoria",
    "subcategoria",
    "elemento",
    "punto_venta",
    "titulo",
    "descripcion",
    "asignado_a",
    "estado",
    "fecha_creacion",
    "fecha_asignacion",
    "fecha_primera_respuesta",
    "fecha_resolucion",
    "tiempo_resolucion_minutos",
    "tiempo_en_pausa_minutos",
    "tiempo_resolucion_efectivo_minutos",
    "en_pausa",
    "motivo_pausa",
    "estados",
]

_CSV_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value: str) -> str:
    """Neutraliza CSV formula injection y ambiguedad por comas internas.

    Reemplaza comas internas por ';' para que parsers que no respetan
    quotes (algunos scripts, parsers viejos) no confundan las comas de
    descripciones con comas separadoras de columna.
    """
    if value.startswith(_CSV_DANGEROUS_PREFIXES):
        value = f"'{value}"
    return value.replace(",", ";")


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
        fecha_col = _a_bogota(row.fecha)
        entry = (
            f"{row.estado_anterior.value}->{row.estado_nuevo.value} ({fecha_col.strftime('%Y-%m-%d %H:%M')})"
            if fecha_col
            else ""
        )
        historial_map.setdefault(key, []).append(entry)
    return {k: " | ".join(v) for k, v in historial_map.items()}


async def _generar_csv(
    db: AsyncSession,
    filtros: list,
) -> AsyncIterator[bytes]:
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_ALL)

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
            PuntoVenta.nombre.label("punto_venta_nombre"),
        )
        .outerjoin(Empresa, Ticket.empresa_id == Empresa.id)
        .outerjoin(Categoria, Ticket.categoria_id == Categoria.id)
        .outerjoin(Subcategoria, Ticket.subcategoria_id == Subcategoria.id)
        .outerjoin(Usuario, Ticket.agente_id == Usuario.id)
        .outerjoin(PuntoVenta, Ticket.punto_venta_id == PuntoVenta.id)
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
            punto_venta_nombre = r[5] or ""

            tiempo_minutos: int | None = None
            tiempo_efectivo_minutos: int | None = None
            if ticket.fecha_resolucion is not None and ticket.fecha_creacion is not None:
                delta = ticket.fecha_resolucion - ticket.fecha_creacion
                tiempo_minutos = round(delta.total_seconds() / 60)
                tiempo_pausa_seg = ticket.segundos_pausa_acumulado or 0
                if ticket.en_pausa and ticket.fecha_pausa is not None:
                    ahora_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
                    tiempo_pausa_seg += max(
                        int((ahora_utc_naive - ticket.fecha_pausa).total_seconds()), 0
                    )
                efectivo_seg = max(delta.total_seconds() - tiempo_pausa_seg, 0)
                tiempo_efectivo_minutos = round(efectivo_seg / 60)

            tiempo_pausa_minutos: int | None = None
            if ticket.segundos_pausa_acumulado or ticket.en_pausa:
                pausa_seg = ticket.segundos_pausa_acumulado or 0
                if ticket.en_pausa and ticket.fecha_pausa is not None:
                    ahora_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
                    pausa_seg += max(int((ahora_utc_naive - ticket.fecha_pausa).total_seconds()), 0)
                tiempo_pausa_minutos = round(pausa_seg / 60)

            fc = _a_bogota(ticket.fecha_creacion)
            fa = _a_bogota(ticket.fecha_asignacion)
            fpr = _a_bogota(ticket.fecha_primera_respuesta)
            fr = _a_bogota(ticket.fecha_resolucion)

            writer.writerow(
                [
                    str(ticket.id),
                    _csv_safe(empresa_nombre),
                    _csv_safe(categoria_nombre),
                    _csv_safe(subcategoria_nombre),
                    ticket.elemento_afectado.value,
                    _csv_safe(punto_venta_nombre),
                    _csv_safe(ticket.titulo),
                    _csv_safe(ticket.descripcion),
                    _csv_safe(agente_nombre),
                    ticket.estado.value,
                    fc.isoformat() if fc else "",
                    fa.isoformat() if fa else "",
                    fpr.isoformat() if fpr else "",
                    fr.isoformat() if fr else "",
                    tiempo_minutos if tiempo_minutos is not None else "",
                    tiempo_pausa_minutos if tiempo_pausa_minutos is not None else "",
                    tiempo_efectivo_minutos if tiempo_efectivo_minutos is not None else "",
                    "SI" if ticket.en_pausa else "NO",
                    _csv_safe(ticket.motivo_pausa or ""),
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
        bogota_start = datetime.combine(fecha_inicio, time.min, tzinfo=BOGOTA)
        filtros.append(Ticket.fecha_creacion >= bogota_start.astimezone(UTC).replace(tzinfo=None))
    if fecha_fin is not None:
        bogota_end = datetime.combine(fecha_fin, time.max, tzinfo=BOGOTA)
        filtros.append(Ticket.fecha_creacion <= bogota_end.astimezone(UTC).replace(tzinfo=None))
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
