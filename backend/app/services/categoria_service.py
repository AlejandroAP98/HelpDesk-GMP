"""Servicio CRUD de Categorias (solo admin)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categoria import Categoria
from app.schemas.categoria import CategoriaCreate, CategoriaUpdate
from app.utils.exceptions import Conflicto, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion


async def listar(page: int = 1, size: int = 20, db: AsyncSession = None) -> Pagina[Categoria]:
    p = paginacion(page, size)
    total = (await db.execute(select(func.count(Categoria.id)))).scalar_one()
    items = (
        await db.execute(
            select(Categoria).order_by(Categoria.id).offset(p.offset).limit(p.limit)
        )
    ).scalars().all()
    return Pagina.of(list(items), total, p.page, p.size)


async def listar_sin_paginar(db: AsyncSession) -> list[Categoria]:
    items = (
        await db.execute(select(Categoria).order_by(Categoria.id))
    ).scalars().all()
    return list(items)


async def obtener(categoria_id: int, db: AsyncSession) -> Categoria:
    categoria = (
        await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    ).scalar_one_or_none()
    if categoria is None:
        raise RecursoNoEncontrado(f"Categoria {categoria_id} no existe")
    return categoria


async def crear(data: CategoriaCreate, db: AsyncSession) -> Categoria:
    existente = (
        await db.execute(select(Categoria).where(Categoria.nombre == data.nombre))
    ).scalar_one_or_none()
    if existente is not None:
        raise Conflicto(f"Ya existe una categoria con nombre {data.nombre!r}")
    categoria = Categoria(nombre=data.nombre, descripcion=data.descripcion)
    db.add(categoria)
    await db.commit()
    await db.refresh(categoria)
    return categoria


async def actualizar(categoria_id: int, data: CategoriaUpdate, db: AsyncSession) -> Categoria:
    categoria = await obtener(categoria_id, db)
    if data.nombre is not None and data.nombre != categoria.nombre:
        dup = (
            await db.execute(select(Categoria).where(Categoria.nombre == data.nombre))
        ).scalar_one_or_none()
        if dup is not None:
            raise Conflicto(f"Ya existe una categoria con nombre {data.nombre!r}")
        categoria.nombre = data.nombre
    if data.descripcion is not None:
        categoria.descripcion = data.descripcion
    await db.commit()
    await db.refresh(categoria)
    return categoria


async def eliminar(categoria_id: int, db: AsyncSession) -> None:
    categoria = await obtener(categoria_id, db)
    await db.delete(categoria)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise Conflicto("No se puede eliminar: tiene tickets asociados") from exc