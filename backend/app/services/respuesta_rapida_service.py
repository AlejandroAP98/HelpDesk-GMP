from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.respuesta_rapida import RespuestaRapida
from app.models.usuario import Usuario
from app.schemas.respuesta_rapida import (
    RespuestaRapidaCreate,
    RespuestaRapidaOut,
    RespuestaRapidaUpdate,
)
from app.utils.exceptions import RecursoNoEncontrado


async def listar(
    current: Usuario,
    db: AsyncSession,
) -> list[RespuestaRapidaOut]:
    base = (
        select(RespuestaRapida)
        .where(RespuestaRapida.usuario_id == current.id)
        .order_by(RespuestaRapida.titulo.asc())
    )
    result = (await db.execute(base)).scalars().all()
    return [RespuestaRapidaOut.model_validate(r) for r in result]


async def crear(
    data: RespuestaRapidaCreate,
    current: Usuario,
    db: AsyncSession,
) -> RespuestaRapidaOut:
    rr = RespuestaRapida(
        usuario_id=current.id,
        titulo=data.titulo,
        contenido=data.contenido,
    )
    db.add(rr)
    await db.commit()
    await db.refresh(rr)
    return RespuestaRapidaOut.model_validate(rr)


async def actualizar(
    rr_id: UUID,
    data: RespuestaRapidaUpdate,
    current: Usuario,
    db: AsyncSession,
) -> RespuestaRapidaOut:
    rr = (
        await db.execute(
            select(RespuestaRapida).where(
                RespuestaRapida.id == rr_id,
                RespuestaRapida.usuario_id == current.id,
            )
        )
    ).scalar_one_or_none()
    if rr is None:
        raise RecursoNoEncontrado("Respuesta rapida no encontrada")

    if data.titulo is not None:
        rr.titulo = data.titulo
    if data.contenido is not None:
        rr.contenido = data.contenido

    await db.commit()
    await db.refresh(rr)
    return RespuestaRapidaOut.model_validate(rr)


async def eliminar(
    rr_id: UUID,
    current: Usuario,
    db: AsyncSession,
) -> None:
    rr = (
        await db.execute(
            select(RespuestaRapida).where(
                RespuestaRapida.id == rr_id,
                RespuestaRapida.usuario_id == current.id,
            )
        )
    ).scalar_one_or_none()
    if rr is None:
        raise RecursoNoEncontrado("Respuesta rapida no encontrada")

    await db.delete(rr)
    await db.commit()
