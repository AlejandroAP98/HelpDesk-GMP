"""Servicio CRUD de Subcategorías (solo admin)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subcategoria import Subcategoria
from app.schemas.categoria import SubcategoriaCreate, SubcategoriaUpdate
from app.utils.exceptions import Conflicto, RecursoNoEncontrado


async def listar_por_categoria(categoria_id: int, db: AsyncSession) -> list[Subcategoria]:
    items = (
        await db.execute(
            select(Subcategoria)
            .where(Subcategoria.categoria_id == categoria_id)
            .order_by(Subcategoria.id)
        )
    ).scalars().all()
    return list(items)


async def obtener(subcategoria_id: int, db: AsyncSession) -> Subcategoria:
    sub = (
        await db.execute(select(Subcategoria).where(Subcategoria.id == subcategoria_id))
    ).scalar_one_or_none()
    if sub is None:
        raise RecursoNoEncontrado(f"Subcategoría {subcategoria_id} no existe")
    return sub


async def crear(data: SubcategoriaCreate, db: AsyncSession) -> Subcategoria:
    existente = (
        await db.execute(
            select(Subcategoria).where(
                Subcategoria.categoria_id == data.categoria_id,
                Subcategoria.nombre == data.nombre,
            )
        )
    ).scalar_one_or_none()
    if existente is not None:
        raise Conflicto(f"Ya existe una subcategoría con nombre {data.nombre!r} en esa categoría")
    sub = Subcategoria(
        categoria_id=data.categoria_id,
        nombre=data.nombre,
        descripcion=data.descripcion,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


async def actualizar(
    subcategoria_id: int, data: SubcategoriaUpdate, db: AsyncSession
) -> Subcategoria:
    sub = await obtener(subcategoria_id, db)
    if data.nombre is not None and data.nombre != sub.nombre:
        dup = (
            await db.execute(
                select(Subcategoria).where(
                    Subcategoria.categoria_id == sub.categoria_id,
                    Subcategoria.nombre == data.nombre,
                )
            )
        ).scalar_one_or_none()
        if dup is not None:
            raise Conflicto(f"Ya existe una subcategoría con nombre {data.nombre!r} en esa categoría")
        sub.nombre = data.nombre
    if data.descripcion is not None:
        sub.descripcion = data.descripcion
    await db.commit()
    await db.refresh(sub)
    return sub


async def eliminar(subcategoria_id: int, db: AsyncSession) -> None:
    sub = await obtener(subcategoria_id, db)
    await db.delete(sub)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise Conflicto("No se puede eliminar: tiene tickets asociados") from exc
