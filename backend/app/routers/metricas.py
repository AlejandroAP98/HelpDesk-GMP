"""Endpoints de metricas e indicadores de rendimiento."""

from __future__ import annotations

from datetime import date, datetime, time
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import ColumnElement, Integer, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import require_mesa_ayuda
from app.models.empresa import Empresa
from app.models.enums import ElementoInfraestructura, EstadoTicket, PrioridadTicket
from app.models.historial_estado import HistorialEstado
from app.models.punto_venta import PuntoVenta
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.metricas import (
    ConteoPorEstado,
    ConteoPorPrioridad,
    DesgloseElemento,
    MetricasInfraestructura,
    MetricasReaperturas,
    MetricasRendimiento,
    MetricasSLA,
    MetricasTiempos,
    MetricasTiempoPorAgente,
    MetricasVolumen,
    ReaperturaItem,
    RendimientoAgente,
    SLAItem,
    TiempoResolucionAgente,
    TopUbicacion,
    VolumenPorEmpresa,
)

router = APIRouter(prefix="/api/metricas", tags=["metricas"])


@router.get("/tiempos", response_model=MetricasTiempos)
async def tiempos(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasTiempos:
    filtros: list = []
    if fecha_inicio is not None:
        filtros.append(Ticket.fecha_creacion >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin is not None:
        filtros.append(Ticket.fecha_creacion <= datetime.combine(fecha_fin, time.max))
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    stmt_resueltos = select(
        func.avg(func.extract("epoch", Ticket.fecha_resolucion - Ticket.fecha_creacion) / 3600.0),
        func.count(Ticket.id),
    ).where(
        Ticket.fecha_resolucion.isnot(None),
        *filtros,
    )
    row = (await db.execute(stmt_resueltos)).one()
    mttr_horas: float | None = round(row[0], 2) if row[0] is not None else None
    tickets_resueltos: int = row[1]

    stmt_primera = select(
        func.avg(
            func.extract("epoch", Ticket.fecha_primera_respuesta - Ticket.fecha_creacion) / 60.0
        ),
        func.count(Ticket.id),
    ).where(
        Ticket.fecha_primera_respuesta.isnot(None),
        *filtros,
    )
    row2 = (await db.execute(stmt_primera)).one()
    tfr_minutos: float | None = round(row2[0], 2) if row2[0] is not None else None
    tickets_tfr: int = row2[1]

    return MetricasTiempos(
        mttr_horas=mttr_horas,
        tiempo_primera_respuesta_minutos=tfr_minutos,
        tickets_resueltos_analizados=tickets_resueltos,
        tickets_con_primera_respuesta=tickets_tfr,
    )


@router.get("/volumen", response_model=MetricasVolumen)
async def volumen(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasVolumen:
    filtros: list = []
    if fecha_inicio is not None:
        filtros.append(Ticket.fecha_creacion >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin is not None:
        filtros.append(Ticket.fecha_creacion <= datetime.combine(fecha_fin, time.max))
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    stmt_estado = (
        select(Ticket.estado, func.count(Ticket.id).label("cantidad"))
        .where(*filtros)
        .group_by(Ticket.estado)
    )
    rows_estado = (await db.execute(stmt_estado)).all()
    por_estado = [
        ConteoPorEstado(
            estado=row[0].value if hasattr(row[0], "value") else str(row[0]), cantidad=row[1]
        )
        for row in rows_estado
    ]

    stmt_prioridad = (
        select(Ticket.prioridad, func.count(Ticket.id).label("cantidad"))
        .where(*filtros)
        .group_by(Ticket.prioridad)
    )
    rows_prioridad = (await db.execute(stmt_prioridad)).all()
    por_prioridad = [
        ConteoPorPrioridad(
            prioridad=row[0].value if hasattr(row[0], "value") else str(row[0]),
            cantidad=row[1],
        )
        for row in rows_prioridad
    ]

    stmt_empresas = (
        select(
            Ticket.empresa_id,
            Empresa.nombre.label("empresa_nombre"),
            func.count(Ticket.id).label("cantidad"),
        )
        .outerjoin(Empresa, Ticket.empresa_id == Empresa.id)
        .where(*filtros)
        .group_by(Ticket.empresa_id, Empresa.nombre)
        .order_by(func.count(Ticket.id).desc())
        .limit(10)
    )
    rows_empresas = (await db.execute(stmt_empresas)).all()
    top_empresas = [
        VolumenPorEmpresa(
            empresa_id=row[0],
            empresa_nombre=row[1],
            cantidad=row[2],
        )
        for row in rows_empresas
    ]

    return MetricasVolumen(
        por_estado=por_estado,
        por_prioridad=por_prioridad,
        top_empresas=top_empresas,
    )


@router.get("/infraestructura", response_model=MetricasInfraestructura)
async def infraestructura(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasInfraestructura:
    filtros: list = []
    if fecha_inicio is not None:
        filtros.append(Ticket.fecha_creacion >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin is not None:
        filtros.append(Ticket.fecha_creacion <= datetime.combine(fecha_fin, time.max))
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    stmt_total = select(func.count(Ticket.id)).where(*filtros)
    total = (await db.execute(stmt_total)).scalar_one()

    stmt_elemento = (
        select(Ticket.elemento_afectado, func.count(Ticket.id).label("cantidad"))
        .where(*filtros)
        .group_by(Ticket.elemento_afectado)
    )
    rows_elemento = (await db.execute(stmt_elemento)).all()
    por_elemento = [
        DesgloseElemento(
            elemento=row[0].value if hasattr(row[0], "value") else str(row[0]),
            cantidad=row[1],
            porcentaje=round((row[1] / total) * 100, 2) if total > 0 else 0.0,
        )
        for row in rows_elemento
    ]

    stmt_ubicaciones = (
        select(Ticket.nombre_punto, func.count(Ticket.id).label("cantidad"))
        .where(
            Ticket.nombre_punto.isnot(None),
            *filtros,
        )
        .group_by(Ticket.nombre_punto)
        .order_by(func.count(Ticket.id).desc())
        .limit(5)
    )
    rows_ubicaciones = (await db.execute(stmt_ubicaciones)).all()
    top_ubicaciones = [
        TopUbicacion(nombre_punto=row[0], cantidad=row[1]) for row in rows_ubicaciones
    ]

    return MetricasInfraestructura(
        por_elemento=por_elemento,
        top_ubicaciones=top_ubicaciones,
    )


def _filtros_base(
    fecha_inicio: date | None,
    fecha_fin: date | None,
    empresa_id: int | None,
) -> list:
    filtros: list = []
    if fecha_inicio is not None:
        filtros.append(Ticket.fecha_creacion >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin is not None:
        filtros.append(Ticket.fecha_creacion <= datetime.combine(fecha_fin, time.max))
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)
    return filtros


@router.get("/rendimiento-agente", response_model=MetricasRendimiento)
async def rendimiento_agente(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasRendimiento:
    filtros = _filtros_base(fecha_inicio, fecha_fin, empresa_id)

    stmt = (
        select(
            Usuario.id.label("agente_id"),
            Usuario.nombre.label("agente_nombre"),
            func.count(Ticket.id).label("asignados"),
            func.sum(func.cast(Ticket.estado == EstadoTicket.resuelto, Integer)).label("resueltos"),
            func.sum(func.cast(Ticket.estado == EstadoTicket.cerrado, Integer)).label("cerrados"),
        )
        .join(Ticket, Ticket.agente_id == Usuario.id)
        .where(Usuario.rol == "agente", Ticket.agente_id.isnot(None), *filtros)
        .group_by(Usuario.id, Usuario.nombre)
        .order_by(func.count(Ticket.id).desc())
    )
    rows = (await db.execute(stmt)).all()
    return MetricasRendimiento(
        por_agente=[
            RendimientoAgente(
                agente_id=str(r.agente_id),
                agente_nombre=r.agente_nombre,
                asignados=r.asignados,
                resueltos=r.resueltos or 0,
                cerrados=r.cerrados or 0,
            )
            for r in rows
        ]
    )


@router.get("/tiempo-por-agente", response_model=MetricasTiempoPorAgente)
async def tiempo_por_agente(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasTiempoPorAgente:
    filtros = _filtros_base(fecha_inicio, fecha_fin, empresa_id)

    stmt = (
        select(
            Usuario.id.label("agente_id"),
            Usuario.nombre.label("agente_nombre"),
            func.avg(
                func.extract("epoch", Ticket.fecha_resolucion - Ticket.fecha_creacion) / 3600.0
            ).label("mttr_horas"),
            func.count(Ticket.id).label("tickets_analizados"),
        )
        .join(Ticket, Ticket.agente_id == Usuario.id)
        .where(
            Ticket.fecha_resolucion.isnot(None),
            Ticket.agente_id.isnot(None),
            *filtros,
        )
        .group_by(Usuario.id, Usuario.nombre)
        .order_by(
            func.avg(
                func.extract("epoch", Ticket.fecha_resolucion - Ticket.fecha_creacion) / 3600.0
            )
        )
    )
    rows = (await db.execute(stmt)).all()
    return MetricasTiempoPorAgente(
        por_agente=[
            TiempoResolucionAgente(
                agente_id=str(r.agente_id),
                agente_nombre=r.agente_nombre,
                mttr_horas=round(r.mttr_horas, 2) if r.mttr_horas is not None else None,
                tickets_analizados=r.tickets_analizados,
            )
            for r in rows
        ]
    )


@router.get("/reaperturas", response_model=MetricasReaperturas)
async def reaperturas(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasReaperturas:
    filtros: list = []
    if fecha_inicio is not None:
        filtros.append(HistorialEstado.fecha >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin is not None:
        filtros.append(HistorialEstado.fecha <= datetime.combine(fecha_fin, time.max))
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    stmt = (
        select(
            HistorialEstado.ticket_id,
            Ticket.titulo,
            Usuario.nombre.label("agente_nombre"),
            HistorialEstado.fecha.label("fecha_reapertura"),
        )
        .join(Ticket, HistorialEstado.ticket_id == Ticket.id)
        .outerjoin(Usuario, Ticket.agente_id == Usuario.id)
        .where(
            HistorialEstado.estado_anterior.in_([EstadoTicket.resuelto, EstadoTicket.cerrado]),
            HistorialEstado.estado_nuevo == EstadoTicket.abierto,
            *filtros,
        )
        .order_by(HistorialEstado.fecha.desc())
    )

    rows = (await db.execute(stmt)).all()

    ticket_count: dict[str, int] = {}
    for r in rows:
        tid = str(r.ticket_id)
        ticket_count[tid] = ticket_count.get(tid, 0) + 1

    seen: set[str] = set()
    tickets: list[ReaperturaItem] = []
    for r in rows:
        tid = str(r.ticket_id)
        if tid not in seen:
            seen.add(tid)
            tickets.append(
                ReaperturaItem(
                    ticket_id=tid,
                    titulo=r.titulo,
                    agente_nombre=r.agente_nombre,
                    fecha_reapertura=r.fecha_reapertura.strftime("%Y-%m-%d %H:%M"),
                    veces_reabierto=ticket_count[tid],
                )
            )

    return MetricasReaperturas(
        total_reaperturas=len(rows),
        tickets=tickets,
    )


def _ciudades_base_normalizadas() -> frozenset[str]:
    return frozenset(_normalizar_texto(c) for c in settings.sla_ciudades_base)


def _normalizar_texto(s: str) -> str:
    reemplazos = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")
    return s.lower().translate(reemplazos).strip()


SLA_FRT_HORAS: float = settings.sla_frt_horas
SLA_MTTR_HORAS: float = settings.sla_mttr_horas
SLA_MTTR_REMOTO_HORAS: float = settings.sla_mttr_remoto_horas
SLA_MTTR_TORRE_CELDA_HORAS: float = settings.sla_mttr_torre_celda_horas
SLA_MTTR_MEDIA_HORAS: float = settings.sla_mttr_media_horas
SLA_MTTR_BAJA_HORAS: float = settings.sla_mttr_baja_horas
SLA_CIUDADES_BASE: frozenset[str] = _ciudades_base_normalizadas()


def _normalizar_ciudad() -> ColumnElement[str]:
    """Expresion SQL que normaliza pv.ciudad (minusculas, sin acentos)."""
    return func.lower(
        func.translate(
            PuntoVenta.ciudad,
            "áéíóúüñÁÉÍÓÚÜÑ",
            "aeiouunAEIOUUN",
        )
    )


def _es_sede_remota() -> ColumnElement[bool]:
    """True si el ticket es de punto de venta con ciudad fuera de las ciudades base."""
    ciudad = _normalizar_ciudad()
    return (
        (Ticket.elemento_afectado == ElementoInfraestructura.punto_venta)
        & Ticket.punto_venta_id.isnot(None)
        & ciudad.isnot(None)
        & ciudad.notin_(SLA_CIUDADES_BASE)
    )


def _es_torre_celda() -> ColumnElement[bool]:
    """True si el ticket es de torre o celda (SLA corto, sin importar la ciudad)."""
    return Ticket.elemento_afectado.in_(
        [ElementoInfraestructura.torre, ElementoInfraestructura.celda]
    )


def _umbral_mttr_segundos() -> ColumnElement[float]:
    """Umbral MTTR por ticket (prioridad en vivo + elemento + ciudad):
    - media: 96h (4 dias), baja: 144h (6 dias), sin importar elemento ni ciudad.
    - urgente/alta: torre/celda 4h, punto de venta remoto 48h, resto 24h."""
    es_media = Ticket.prioridad == PrioridadTicket.media
    es_baja = Ticket.prioridad == PrioridadTicket.baja
    return case(
        (es_media, SLA_MTTR_MEDIA_HORAS * 3600),
        (es_baja, SLA_MTTR_BAJA_HORAS * 3600),
        else_=case(
            (_es_torre_celda(), SLA_MTTR_TORRE_CELDA_HORAS * 3600),
            (_es_sede_remota(), SLA_MTTR_REMOTO_HORAS * 3600),
            else_=SLA_MTTR_HORAS * 3600,
        ),
    )


async def _calcular_sla_empresa(
    db: AsyncSession,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    empresa_id: int | None = None,
) -> dict:
    filtros: list = [
        Ticket.fecha_creacion >= fecha_inicio,
        Ticket.fecha_creacion <= fecha_fin,
    ]
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    umbral_mttr = _umbral_mttr_segundos()
    frt_segundos = func.extract("epoch", Ticket.fecha_primera_respuesta - Ticket.fecha_creacion)
    mttr_segundos = func.extract("epoch", Ticket.fecha_resolucion - Ticket.fecha_creacion)
    es_critico = Ticket.prioridad.in_([PrioridadTicket.urgente, PrioridadTicket.alta])
    es_media = Ticket.prioridad == PrioridadTicket.media
    es_baja = Ticket.prioridad == PrioridadTicket.baja

    stmt_total = (
        select(
            Ticket.empresa_id,
            Empresa.nombre.label("empresa_nombre"),
            func.count(Ticket.id).label("total"),
            func.sum(
                func.cast(
                    (Ticket.fecha_primera_respuesta.isnot(None))
                    & (frt_segundos <= SLA_FRT_HORAS * 3600)
                    & (
                        (Ticket.fecha_resolucion.is_(None))
                        | (Ticket.fecha_resolucion.isnot(None) & (mttr_segundos <= umbral_mttr))
                    ),
                    Integer,
                )
            ).label("en_sla"),
            func.avg(frt_segundos / 3600.0).label("frt_horas"),
            func.avg(mttr_segundos / 3600.0).label("mttr_horas"),
            func.avg(case((es_critico, mttr_segundos / 3600.0))).label("mttr_urgente_horas"),
            func.avg(case((es_media, mttr_segundos / 3600.0))).label("mttr_media_horas"),
            func.avg(case((es_baja, mttr_segundos / 3600.0))).label("mttr_baja_horas"),
        )
        .join(Empresa, Ticket.empresa_id == Empresa.id)
        .outerjoin(PuntoVenta, Ticket.punto_venta_id == PuntoVenta.id)
        .where(*filtros)
    )

    stmt_grupo = stmt_total.group_by(Ticket.empresa_id, Empresa.nombre).order_by(
        func.count(Ticket.id).desc()
    )

    rows = (await db.execute(stmt_grupo)).all()
    return {
        r.empresa_id: {
            "empresa_nombre": r.empresa_nombre,
            "total": r.total,
            "en_sla": r.en_sla or 0,
            "frt_horas": round(r.frt_horas, 2) if r.frt_horas is not None else None,
            "mttr_horas": round(r.mttr_horas, 2) if r.mttr_horas is not None else None,
            "mttr_urgente_horas": (
                round(r.mttr_urgente_horas, 2) if r.mttr_urgente_horas is not None else None
            ),
            "mttr_media_horas": (
                round(r.mttr_media_horas, 2) if r.mttr_media_horas is not None else None
            ),
            "mttr_baja_horas": (
                round(r.mttr_baja_horas, 2) if r.mttr_baja_horas is not None else None
            ),
        }
        for r in rows
    }


@router.get("/sla", response_model=MetricasSLA)
async def metricas_sla(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasSLA:
    if fecha_inicio is None:
        hoy = date.today()
        fecha_inicio = hoy.replace(day=1)
    if fecha_fin is None:
        fecha_fin = date.today()

    fin_dt = datetime.combine(fecha_fin, time.max)
    inicio_dt = datetime.combine(fecha_inicio, time.min)

    mes_anterior_fin = inicio_dt - relativedelta(days=1)
    mes_anterior_inicio = mes_anterior_fin.replace(day=1)

    actual = await _calcular_sla_empresa(db, inicio_dt, fin_dt, empresa_id)
    anterior = await _calcular_sla_empresa(db, mes_anterior_inicio, mes_anterior_fin, empresa_id)

    por_empresa: list[SLAItem] = []
    for eid, data in actual.items():
        ant = anterior.get(eid)
        total = data["total"]
        en_sla = data["en_sla"]
        pct = round((en_sla / total) * 100, 1) if total > 0 else 0.0

        item = SLAItem(
            empresa_id=eid,
            empresa_nombre=data["empresa_nombre"],
            total_tickets=total,
            tickets_en_sla=en_sla,
            porcentaje_sla=pct,
            frt_horas=data["frt_horas"],
            mttr_horas=data["mttr_horas"],
            mttr_urgente_horas=data["mttr_urgente_horas"],
            mttr_media_horas=data["mttr_media_horas"],
            mttr_baja_horas=data["mttr_baja_horas"],
            total_tickets_mes_anterior=ant["total"] if ant else None,
            porcentaje_sla_mes_anterior=(
                round((ant["en_sla"] / ant["total"]) * 100, 1) if ant and ant["total"] > 0 else None
            ),
            frt_horas_mes_anterior=ant["frt_horas"] if ant else None,
            mttr_horas_mes_anterior=ant["mttr_horas"] if ant else None,
        )
        por_empresa.append(item)

    for eid, data in anterior.items():
        if eid not in actual:
            ant_total = data["total"]
            ant_en_sla = data["en_sla"]
            ant_pct = round((ant_en_sla / ant_total) * 100, 1) if ant_total > 0 else 0.0
            por_empresa.append(
                SLAItem(
                    empresa_id=eid,
                    empresa_nombre=data["empresa_nombre"],
                    total_tickets=0,
                    tickets_en_sla=0,
                    porcentaje_sla=0.0,
                    frt_horas=None,
                    mttr_horas=None,
                    total_tickets_mes_anterior=ant_total,
                    porcentaje_sla_mes_anterior=ant_pct,
                    frt_horas_mes_anterior=data["frt_horas"],
                    mttr_horas_mes_anterior=data["mttr_horas"],
                )
            )

    return MetricasSLA(
        sla_objetivo_frt_horas=SLA_FRT_HORAS,
        sla_objetivo_mttr_horas=SLA_MTTR_HORAS,
        sla_objetivo_mttr_remoto_horas=SLA_MTTR_REMOTO_HORAS,
        sla_objetivo_mttr_torre_celda_horas=SLA_MTTR_TORRE_CELDA_HORAS,
        sla_objetivo_mttr_media_horas=SLA_MTTR_MEDIA_HORAS,
        sla_objetivo_mttr_baja_horas=SLA_MTTR_BAJA_HORAS,
        por_empresa=por_empresa,
    )
