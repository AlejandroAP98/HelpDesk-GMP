"""Endpoints de metricas e indicadores de rendimiento."""

from __future__ import annotations

from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.empresa import Empresa
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.metricas import (
    ConteoPorEstado,
    ConteoPorPrioridad,
    DesgloseElemento,
    MetricasInfraestructura,
    MetricasTiempos,
    MetricasVolumen,
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
    current: Usuario = Depends(require_admin),
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
    current: Usuario = Depends(require_admin),
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
    current: Usuario = Depends(require_admin),
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
