"""Servicio CRUD de Puntos de Venta."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empresa import Empresa
from app.models.punto_venta import PuntoVenta
from app.schemas.punto_venta import (
    PuntoVentaCreate,
    PuntoVentaOut,
    PuntoVentaUpdate,
)
from app.utils.exceptions import Conflicto, PermisoDenegado, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion


async def listar(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    empresa_id: int | None = None,
) -> Pagina[tuple[PuntoVenta, str | None]]:
    p = paginacion(page, size)
    base = select(PuntoVenta, Empresa.nombre.label("empresa_nombre")).outerjoin(
        Empresa, PuntoVenta.empresa_id == Empresa.id
    )
    count_base = select(func.count(PuntoVenta.id))

    if empresa_id is not None:
        base = base.where(PuntoVenta.empresa_id == empresa_id)
        count_base = count_base.where(PuntoVenta.empresa_id == empresa_id)

    total = (await db.execute(count_base)).scalar_one()
    rows = (
        await db.execute(
            base.order_by(PuntoVenta.empresa_id, PuntoVenta.nombre)
            .offset(p.offset)
            .limit(p.limit)
        )
    ).all()
    items = [(pv, emp_nombre) for pv, emp_nombre in rows]
    return Pagina.of(items, total, p.page, p.size)


async def listar_por_empresa(
    empresa_id: int,
    solo_activos: bool,
    db: AsyncSession,
) -> list[PuntoVenta]:
    stmt = select(PuntoVenta).where(PuntoVenta.empresa_id == empresa_id)
    if solo_activos:
        stmt = stmt.where(PuntoVenta.activo.is_(True))
    stmt = stmt.order_by(PuntoVenta.nombre)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def obtener(punto_venta_id: int, db: AsyncSession) -> PuntoVenta:
    pv = (
        await db.execute(
            select(PuntoVenta).where(PuntoVenta.id == punto_venta_id)
        )
    ).scalar_one_or_none()
    if pv is None:
        raise RecursoNoEncontrado(f"Punto de venta {punto_venta_id} no existe")
    return pv


async def crear(data: PuntoVentaCreate, db: AsyncSession) -> PuntoVenta:
    existente = (
        await db.execute(
            select(PuntoVenta).where(
                PuntoVenta.empresa_id == data.empresa_id,
                PuntoVenta.nombre == data.nombre,
            )
        )
    ).scalar_one_or_none()
    if existente is not None:
        raise Conflicto(f"Ya existe un punto de venta '{data.nombre}' en esa empresa")

    pv = PuntoVenta(
        empresa_id=data.empresa_id,
        nombre=data.nombre,
        direccion=data.direccion,
        ciudad=data.ciudad,
        activo=True,
    )
    db.add(pv)
    await db.commit()
    await db.refresh(pv)
    return pv


async def actualizar(
    punto_venta_id: int, data: PuntoVentaUpdate, db: AsyncSession
) -> PuntoVenta:
    pv = await obtener(punto_venta_id, db)
    for field in ("nombre", "direccion", "ciudad", "activo"):
        val = getattr(data, field)
        if val is not None:
            setattr(pv, field, val)
    await db.commit()
    await db.refresh(pv)
    return pv


async def eliminar(punto_venta_id: int, db: AsyncSession) -> None:
    pv = await obtener(punto_venta_id, db)
    await db.delete(pv)
    await db.commit()
