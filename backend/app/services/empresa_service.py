"""Servicio CRUD de Empresas (solo admin)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaCreate, EmpresaUpdate
from app.utils.exceptions import Conflicto, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion


async def listar(page: int = 1, size: int = 20, db: AsyncSession = None) -> Pagina[Empresa]:
    p = paginacion(page, size)
    total = (await db.execute(select(func.count(Empresa.id)))).scalar_one()
    items = (
        await db.execute(
            select(Empresa).order_by(Empresa.id).offset(p.offset).limit(p.limit)
        )
    ).scalars().all()
    return Pagina.of(list(items), total, p.page, p.size)


async def obtener(empresa_id: int, db: AsyncSession) -> Empresa:
    empresa = (
        await db.execute(select(Empresa).where(Empresa.id == empresa_id))
    ).scalar_one_or_none()
    if empresa is None:
        raise RecursoNoEncontrado(f"Empresa {empresa_id} no existe")
    return empresa


async def crear(data: EmpresaCreate, db: AsyncSession) -> Empresa:
    empresa = Empresa(nombre=data.nombre)
    db.add(empresa)
    await db.commit()
    await db.refresh(empresa)
    return empresa


async def actualizar(empresa_id: int, data: EmpresaUpdate, db: AsyncSession) -> Empresa:
    empresa = await obtener(empresa_id, db)
    if data.nombre is not None:
        empresa.nombre = data.nombre
    await db.commit()
    await db.refresh(empresa)
    return empresa


async def eliminar(empresa_id: int, db: AsyncSession) -> None:
    empresa = await obtener(empresa_id, db)
    await db.delete(empresa)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise Conflicto("No se puede eliminar: tiene tickets o usuarios asociados") from exc