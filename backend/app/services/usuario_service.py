"""Servicio CRUD de Usuarios (admin)."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empresa import Empresa
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.core.security import hash_password
from app.schemas.usuario import UsuarioOut, UsuarioUpdateByAdmin
from app.utils.exceptions import Conflicto, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion


async def listar(
    page: int = 1,
    size: int = 20,
    rol: RolUsuario | None = None,
    empresa_id: int | None = None,
    db: AsyncSession = None,
) -> Pagina[UsuarioOut]:
    p = paginacion(page, size)
    stmt = select(Usuario)
    count_stmt = select(func.count(Usuario.id))
    if rol is not None:
        stmt = stmt.where(Usuario.rol == rol)
        count_stmt = count_stmt.where(Usuario.rol == rol)
    if empresa_id is not None:
        stmt = stmt.where(Usuario.empresa_id == empresa_id)
        count_stmt = count_stmt.where(Usuario.empresa_id == empresa_id)
    total = (await db.execute(count_stmt)).scalar_one()
    items = (
        await db.execute(stmt.order_by(Usuario.fecha_creacion.desc()).offset(p.offset).limit(p.limit))
    ).scalars().all()
    return Pagina.of([UsuarioOut.model_validate(u) for u in items], total, p.page, p.size)


async def obtener(usuario_id: UUID, db: AsyncSession) -> Usuario:
    usuario = (
        await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    ).scalar_one_or_none()
    if usuario is None:
        raise RecursoNoEncontrado(f"Usuario {usuario_id} no existe")
    return usuario


async def actualizar(usuario_id: UUID, data: UsuarioUpdateByAdmin, db: AsyncSession) -> Usuario:
    usuario = await obtener(usuario_id, db)
    if data.email is not None and data.email != usuario.email:
        dup = (
            await db.execute(select(Usuario).where(Usuario.email == data.email))
        ).scalar_one_or_none()
        if dup is not None:
            raise Conflicto("Email ya registrado")
        usuario.email = data.email
    if data.nombre is not None:
        usuario.nombre = data.nombre
    if data.rol is not None:
        usuario.rol = data.rol
    if data.empresa_id is not None:
        empresa = (
            await db.execute(select(Empresa).where(Empresa.id == data.empresa_id))
        ).scalar_one_or_none()
        if empresa is None:
            raise RecursoNoEncontrado(f"Empresa {data.empresa_id} no existe")
        usuario.empresa_id = data.empresa_id
    if data.password is not None:
        usuario.password_hash = hash_password(data.password)
    await db.commit()
    await db.refresh(usuario)
    return usuario


async def eliminar(usuario_id: UUID, db: AsyncSession) -> None:
    usuario = await obtener(usuario_id, db)
    await db.delete(usuario)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise Conflicto("No se puede eliminar: tiene tickets o comentarios asociados") from exc