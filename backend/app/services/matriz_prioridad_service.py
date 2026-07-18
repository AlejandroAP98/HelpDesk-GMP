"""Servicio CRUD de MatrizPrioridad (solo admin)."""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.matriz_prioridad import MatrizPrioridad
from app.schemas.matriz_prioridad import MatrizPrioridadBulk, MatrizPrioridadCreate
from app.utils.exceptions import Conflicto, RecursoNoEncontrado


async def listar_por_categoria(
    categoria_id: int, db: AsyncSession
) -> list[MatrizPrioridad]:
    result = await db.execute(
        select(MatrizPrioridad).where(MatrizPrioridad.categoria_id == categoria_id)
    )
    return list(result.scalars().all())


async def obtener(item_id: int, db: AsyncSession) -> MatrizPrioridad:
    item = (
        await db.execute(
            select(MatrizPrioridad).where(MatrizPrioridad.id == item_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise RecursoNoEncontrado(f"Entrada de matriz {item_id} no existe")
    return item


async def crear(data: MatrizPrioridadCreate, db: AsyncSession) -> MatrizPrioridad:
    existente = (
        await db.execute(
            select(MatrizPrioridad).where(
                MatrizPrioridad.categoria_id == data.categoria_id,
                MatrizPrioridad.subcategoria_id == data.subcategoria_id,
                MatrizPrioridad.elemento == data.elemento,
            )
        )
    ).scalar_one_or_none()
    if existente is not None:
        raise Conflicto(
            "Ya existe una entrada de prioridad para esa combinacion "
            "de categoria, subcategoria y elemento"
        )
    item = MatrizPrioridad(
        categoria_id=data.categoria_id,
        subcategoria_id=data.subcategoria_id,
        elemento=data.elemento,
        prioridad=data.prioridad,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def actualizar_prioridad(
    item_id: int, prioridad: str, db: AsyncSession
) -> MatrizPrioridad:
    item = await obtener(item_id, db)
    item.prioridad = prioridad
    await db.commit()
    await db.refresh(item)
    return item


async def eliminar(item_id: int, db: AsyncSession) -> None:
    item = await obtener(item_id, db)
    await db.delete(item)
    await db.commit()


async def sincronizar_categoria(
    categoria_id: int, data: MatrizPrioridadBulk, db: AsyncSession
) -> list[MatrizPrioridad]:
    """Reemplaza todas las entradas de matriz para una categoria."""
    await db.execute(
        delete(MatrizPrioridad).where(MatrizPrioridad.categoria_id == categoria_id)
    )
    items: list[MatrizPrioridad] = []
    for entry in data.items:
        item = MatrizPrioridad(
            categoria_id=categoria_id,
            subcategoria_id=entry.subcategoria_id,
            elemento=entry.elemento,
            prioridad=entry.prioridad,
        )
        db.add(item)
        items.append(item)
    await db.commit()
    for item in items:
        await db.refresh(item)
    return items
