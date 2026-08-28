"""Servicio CRUD de Puntos de Venta."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import tenant_filter
from app.models.empresa import Empresa
from app.models.punto_venta import PuntoVenta
from app.models.usuario import Usuario
from app.schemas.punto_venta import (
    PuntoVentaCreate,
    PuntoVentaUpdate,
)
from app.utils.exceptions import Conflicto, PermisoDenegado, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion


def _empresa_permitida(current: Usuario, empresa_id: int | None) -> int | None:
    """Resuelve el `empresa_id` efectivo aplicando aislamiento multi-tenant.

    - cliente: siempre su propia empresa (ignora el query param ajeno).
    - demas roles: respeta `empresa_id` si viene, sino None (todas).
    """
    tf = tenant_filter(current)
    if "empresa_id" in tf:
        return tf["empresa_id"]
    return empresa_id


async def listar(
    current: Usuario,
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    empresa_id: int | None = None,
    q: str | None = None,
) -> Pagina[tuple[PuntoVenta, str | None]]:
    p = paginacion(page, size)
    base = select(PuntoVenta, Empresa.nombre.label("empresa_nombre")).outerjoin(
        Empresa, PuntoVenta.empresa_id == Empresa.id
    )
    count_base = select(func.count(PuntoVenta.id))

    ef_empresa_id = _empresa_permitida(current, empresa_id)
    if ef_empresa_id is not None:
        base = base.where(PuntoVenta.empresa_id == ef_empresa_id)
        count_base = count_base.where(PuntoVenta.empresa_id == ef_empresa_id)

    if q and len(q.strip()) >= 2:
        like = f"%{q.strip()}%"
        filtro = PuntoVenta.nombre.ilike(like)
        base = base.where(filtro)
        count_base = count_base.where(filtro)

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
    current: Usuario,
    db: AsyncSession,
) -> list[PuntoVenta]:
    tf = tenant_filter(current)
    if "empresa_id" in tf and tf["empresa_id"] != empresa_id:
        raise PermisoDenegado("No tienes acceso a puntos de venta de otra empresa")
    stmt = select(PuntoVenta).where(PuntoVenta.empresa_id == empresa_id)
    if solo_activos:
        stmt = stmt.where(PuntoVenta.activo.is_(True))
    stmt = stmt.order_by(PuntoVenta.nombre)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def obtener(
    punto_venta_id: int, current: Usuario, db: AsyncSession
) -> PuntoVenta:
    pv = (
        await db.execute(
            select(PuntoVenta).where(PuntoVenta.id == punto_venta_id)
        )
    ).scalar_one_or_none()
    if pv is None:
        raise RecursoNoEncontrado(f"Punto de venta {punto_venta_id} no existe")
    tf = tenant_filter(current)
    if "empresa_id" in tf and pv.empresa_id != tf["empresa_id"]:
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
