"""Endpoints de metricas e indicadores de rendimiento."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Integer, case, func, select
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
    CeldaDistribucion,
    ConteoPorEstado,
    ConteoPorPrioridad,
    DesgloseElemento,
    ItemTendencia,
    MetricasDistribucion,
    MetricasInfraestructura,
    MetricasReaperturas,
    MetricasRendimiento,
    MetricasSLA,
    MetricasTendencia,
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
from app.services.horario_laboral import (
    tiempo_pausa_sla_transcurrido,
    tiempo_sla_transcurrido,
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
        func.avg(
            func.greatest(
                func.extract("epoch", Ticket.fecha_resolucion - Ticket.fecha_creacion)
                - Ticket.segundos_pausa_acumulado
                - case(
                    (Ticket.en_pausa, func.extract("epoch", func.now() - Ticket.fecha_pausa)),
                    else_=0,
                ),
                0,
            )
            / 3600.0
        ),
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
        func.sum(
            func.cast(
                func.extract("epoch", Ticket.fecha_primera_respuesta - Ticket.fecha_creacion)
                <= SLA_FRT_HORAS * 3600,
                Integer,
            )
        ),
    ).where(
        Ticket.fecha_primera_respuesta.isnot(None),
        *filtros,
    )
    row2 = (await db.execute(stmt_primera)).one()
    tfr_minutos: float | None = round(row2[0], 2) if row2[0] is not None else None
    tickets_tfr: int = row2[1]
    frt_cumplidos: int = row2[2] or 0
    porcentaje_frt_cumplido: float | None = (
        round((frt_cumplidos / tickets_tfr) * 100, 1) if tickets_tfr > 0 else None
    )

    return MetricasTiempos(
        mttr_horas=mttr_horas,
        tiempo_primera_respuesta_minutos=tfr_minutos,
        tickets_resueltos_analizados=tickets_resueltos,
        tickets_con_primera_respuesta=tickets_tfr,
        porcentaje_frt_cumplido=porcentaje_frt_cumplido,
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


@router.get("/tendencia", response_model=MetricasTendencia)
async def tendencia(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasTendencia:
    """Serie diaria de tickets creados vs resueltos para graficar tendencia.

    Si no se pasan fechas, usa los últimos 30 dias. Los dias sin movimiento se
    devuelven con creados=0 y resueltos=0 para que la linea sea continua.
    """
    tz = settings.app_timezone
    zona = ZoneInfo(tz)
    if fecha_fin is None:
        fecha_fin = datetime.now(zona).date()
    if fecha_inicio is None:
        fecha_inicio = fecha_fin - timedelta(days=29)

    inicio_utc = (
        datetime.combine(fecha_inicio, time.min, tzinfo=zona)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )
    fin_utc = (
        datetime.combine(fecha_fin, time.max, tzinfo=zona)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )
    filtros_comun: list = [
        Ticket.fecha_creacion >= inicio_utc,
        Ticket.fecha_creacion <= fin_utc,
    ]
    if empresa_id is not None:
        filtros_comun.append(Ticket.empresa_id == empresa_id)

    creacion_local = Ticket.fecha_creacion.op("AT TIME ZONE")("UTC").op("AT TIME ZONE")(tz)
    resolucion_local = Ticket.fecha_resolucion.op("AT TIME ZONE")("UTC").op("AT TIME ZONE")(tz)

    stmt_creados = (
        select(
            func.date(creacion_local).label("dia"),
            func.count(Ticket.id).label("cantidad"),
        )
        .where(*filtros_comun)
        .group_by(func.date(creacion_local))
    )
    creados = {
        row.dia: row.cantidad
        for row in (await db.execute(stmt_creados)).all()
        if row.dia is not None
    }

    stmt_resueltos = (
        select(
            func.date(resolucion_local).label("dia"),
            func.count(Ticket.id).label("cantidad"),
        )
        .where(
            Ticket.fecha_resolucion.isnot(None),
            Ticket.fecha_resolucion >= inicio_utc,
            Ticket.fecha_resolucion <= fin_utc,
            *([Ticket.empresa_id == empresa_id] if empresa_id is not None else []),
        )
        .group_by(func.date(resolucion_local))
    )
    resueltos = {
        row.dia: row.cantidad
        for row in (await db.execute(stmt_resueltos)).all()
        if row.dia is not None
    }

    por_dia: list[ItemTendencia] = []
    total_dias = (fecha_fin - fecha_inicio).days + 1
    for i in range(total_dias):
        d = fecha_inicio + timedelta(days=i)
        por_dia.append(
            ItemTendencia(
                dia=d.isoformat(),
                creados=creados.get(d, 0),
                resueltos=resueltos.get(d, 0),
            )
        )
    return MetricasTendencia(por_dia=por_dia)


@router.get("/distribucion", response_model=MetricasDistribucion)
async def distribucion(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> MetricasDistribucion:
    """Heatmap de tickets creados por dia de la semana (0=Domingo..6=Sabado)
    y hora del dia (0..23). El bucketing se hace en la zona horaria del negocio
    (settings.app_timezone) para que la hora local coincida con la del operario."""
    if fecha_fin is None:
        fecha_fin = date.today()
    if fecha_inicio is None:
        fecha_inicio = fecha_fin - timedelta(days=29)

    tz = settings.app_timezone
    filtros: list = [
        Ticket.fecha_creacion >= datetime.combine(fecha_inicio, time.min),
        Ticket.fecha_creacion <= datetime.combine(fecha_fin, time.max),
    ]
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    # El bucket dow/hora debe caer en la zona horaria del operario. La columna
    # `fecha_creacion` es timestamp without time zone en UTC; la doble conversion
    # (UTC -> timestamptz -> timestamp local) deja el valor en hora de COL y
    # EXTRACT(hour FROM timestamp) extrae la hora local. Si la columna pasa a
    # timestamptz en el futuro, basta con aplicar una sola `AT TIME ZONE tz`.
    creacion_local = Ticket.fecha_creacion.op("AT TIME ZONE")("UTC").op("AT TIME ZONE")(tz)
    stmt = (
        select(
            func.extract("dow", creacion_local).label("dow"),
            func.extract("hour", creacion_local).label("hora"),
            func.count(Ticket.id).label("cantidad"),
        )
        .where(*filtros)
        .group_by("dow", "hora")
    )
    rows = (await db.execute(stmt)).all()
    celdas = [
        CeldaDistribucion(dow=int(r.dow), hora=int(r.hora), cantidad=int(r.cantidad)) for r in rows
    ]
    total = sum(c.cantidad for c in celdas)
    return MetricasDistribucion(por_dia_hora=celdas, total=total)


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


def _umbral_mttr_horas_para(
    prioridad: PrioridadTicket,
    elemento: ElementoInfraestructura,
    ciudad: str | None,
) -> float:
    """Replica en Python de la matriz SLA para decidir el umbral por ticket."""
    if prioridad == PrioridadTicket.media:
        return SLA_MTTR_MEDIA_HORAS
    if prioridad == PrioridadTicket.baja:
        return SLA_MTTR_BAJA_HORAS
    if elemento in (ElementoInfraestructura.torre, ElementoInfraestructura.celda):
        return SLA_MTTR_TORRE_CELDA_HORAS
    if (
        elemento == ElementoInfraestructura.punto_venta
        and ciudad is not None
        and _normalizar_texto(ciudad) not in SLA_CIUDADES_BASE
    ):
        return SLA_MTTR_REMOTO_HORAS
    return SLA_MTTR_HORAS


def _promedio_horas(deltas: list[float]) -> float | None:
    if not deltas:
        return None
    return round(sum(deltas) / len(deltas), 2)


async def _calcular_sla_empresa(
    db: AsyncSession,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    empresa_id: int | None = None,
) -> dict:
    """Agrega las metricas de SLA por empresa respetando el horario laboral.

    Estrategia: en una sola query se trae el set minimo de campos por ticket
    (timestamps + prioridad + elemento + ciudad del PV + empresa). El calculo
    de FRT y MTTR se hace en Python con `tiempo_sla_transcurrido(...)`, lo que
    permite aplicar la regla "nacido en horario -> continuo, nacido fuera ->
    arranca al proximo inicio" sin replicarla como CASE en SQL.

    El umbral MTTR por ticket se decide tambien en Python segun la matriz
    prioridad+elemento+ciudad. La agregacion final por empresa es un
    promedio simple sobre los tickets que tienen la metrica.
    """
    filtros: list = [
        Ticket.fecha_creacion >= fecha_inicio,
        Ticket.fecha_creacion <= fecha_fin,
    ]
    if empresa_id is not None:
        filtros.append(Ticket.empresa_id == empresa_id)

    stmt = (
        select(
            Ticket.id,
            Ticket.empresa_id,
            Empresa.nombre.label("empresa_nombre"),
            Ticket.prioridad,
            Ticket.elemento_afectado,
            Ticket.fecha_creacion,
            Ticket.fecha_primera_respuesta,
            Ticket.fecha_resolucion,
            Ticket.segundos_pausa_sla_acumulado,
            Ticket.en_pausa,
            Ticket.fecha_pausa,
            PuntoVenta.ciudad,
        )
        .join(Empresa, Ticket.empresa_id == Empresa.id)
        .outerjoin(PuntoVenta, Ticket.punto_venta_id == PuntoVenta.id)
        .where(*filtros)
    )

    ahora = datetime.now(timezone.utc)
    h_inicio = settings.sla_hora_inicio_laboral
    h_fin = settings.sla_hora_fin_laboral

    acum: dict[int, dict] = defaultdict(
        lambda: {
            "empresa_nombre": None,
            "total": 0,
            "en_sla": 0,
            "frt_deltas": [],
            "mttr_deltas": [],
            "mttr_urgente_deltas": [],
            "mttr_media_deltas": [],
            "mttr_baja_deltas": [],
        }
    )

    for row in (await db.execute(stmt)).all():
        bucket = acum[row.empresa_id]
        bucket["empresa_nombre"] = row.empresa_nombre
        bucket["total"] += 1

        # Descontar solo pausas superpuestas al reloj SLA.
        segundos_pausa_sla = int(row.segundos_pausa_sla_acumulado or 0)
        if row.en_pausa and row.fecha_pausa is not None:
            segundos_pausa_sla += int(
                tiempo_pausa_sla_transcurrido(
                    row.fecha_creacion,
                    row.fecha_pausa,
                    ahora,
                    h_inicio,
                    h_fin,
                ).total_seconds()
            )
        tiempo_pausa_sla = timedelta(seconds=max(segundos_pausa_sla, 0))

        # FRT en horario laboral.
        if row.fecha_primera_respuesta is not None:
            frt_real = tiempo_sla_transcurrido(
                row.fecha_creacion, row.fecha_primera_respuesta, h_inicio, h_fin
            )
        else:
            frt_real = None

        # MTTR en horario laboral.
        if row.fecha_resolucion is not None:
            mttr_lab = tiempo_sla_transcurrido(
                row.fecha_creacion, row.fecha_resolucion, h_inicio, h_fin
            )
            if mttr_lab > tiempo_pausa_sla:
                mttr_efectivo = mttr_lab - tiempo_pausa_sla
            else:
                mttr_efectivo = timedelta(0)
        else:
            mttr_efectivo = None

        # Flags en SLA.
        if frt_real is not None:
            frt_ok = frt_real.total_seconds() <= SLA_FRT_HORAS * 3600
        else:
            frt_ok = False
        if mttr_efectivo is not None:
            umbral_horas = _umbral_mttr_horas_para(
                row.prioridad, row.elemento_afectado, row.ciudad
            )
            mttr_ok = mttr_efectivo.total_seconds() <= umbral_horas * 3600
        else:
            mttr_ok = True
        if frt_real is not None and frt_ok and (mttr_efectivo is None or mttr_ok):
            bucket["en_sla"] += 1

        if frt_real is not None:
            bucket["frt_deltas"].append(frt_real.total_seconds() / 3600.0)
        if mttr_efectivo is not None:
            mttr_horas_val = mttr_efectivo.total_seconds() / 3600.0
            bucket["mttr_deltas"].append(mttr_horas_val)
            if row.prioridad == PrioridadTicket.urgente or row.prioridad == PrioridadTicket.alta:
                bucket["mttr_urgente_deltas"].append(mttr_horas_val)
            elif row.prioridad == PrioridadTicket.media:
                bucket["mttr_media_deltas"].append(mttr_horas_val)
            elif row.prioridad == PrioridadTicket.baja:
                bucket["mttr_baja_deltas"].append(mttr_horas_val)

    return {
        eid: {
            "empresa_nombre": data["empresa_nombre"],
            "total": data["total"],
            "en_sla": data["en_sla"],
            "frt_horas": _promedio_horas(data["frt_deltas"]),
            "mttr_horas": _promedio_horas(data["mttr_deltas"]),
            "mttr_urgente_horas": _promedio_horas(data["mttr_urgente_deltas"]),
            "mttr_media_horas": _promedio_horas(data["mttr_media_deltas"]),
            "mttr_baja_horas": _promedio_horas(data["mttr_baja_deltas"]),
        }
        for eid, data in acum.items()
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
