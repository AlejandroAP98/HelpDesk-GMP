"""Servicio de tareas pendientes (checklist interno de agentes/admins)."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tarea_pendiente import TareaPendiente
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.tarea_pendiente import (
    TareaPendienteCreate,
    TareaPendienteOut,
    TareaPendienteUpdate,
)
from app.services import ticket_service
from app.utils.exceptions import RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion


async def listar(
    current: Usuario,
    db: AsyncSession,
    *,
    page: int = 1,
    size: int = 20,
    completada: bool | None = None,
    ticket_id: UUID | None = None,
) -> Pagina[TareaPendienteOut]:
    base = (
        select(TareaPendiente, Ticket.titulo.label("ticket_titulo"))
        .outerjoin(Ticket, TareaPendiente.ticket_id == Ticket.id)
        .where(TareaPendiente.usuario_id == current.id)
    )
    count_base = select(func.count(TareaPendiente.id)).where(
        TareaPendiente.usuario_id == current.id
    )

    if completada is not None:
        base = base.where(TareaPendiente.completada == completada)
        count_base = count_base.where(TareaPendiente.completada == completada)

    if ticket_id is not None:
        base = base.where(TareaPendiente.ticket_id == ticket_id)
        count_base = count_base.where(TareaPendiente.ticket_id == ticket_id)

    p = paginacion(page, size)
    total = (await db.execute(count_base)).scalar_one()

    rows = (
        await db.execute(
            base.order_by(TareaPendiente.completada.asc(), TareaPendiente.fecha_creacion.desc())
            .offset(p.offset)
            .limit(p.limit)
        )
    ).all()

    out: list[TareaPendienteOut] = []
    for t, ticket_titulo in rows:
        out.append(
            TareaPendienteOut.model_validate(
                {
                    **{k: getattr(t, k) for k in t.__table__.columns.keys()},
                    "ticket_titulo": ticket_titulo,
                }
            )
        )

    return Pagina.of(out, total, p.page, p.size)


async def crear(
    data: TareaPendienteCreate,
    current: Usuario,
    db: AsyncSession,
) -> TareaPendienteOut:
    if data.ticket_id is not None:
        ticket = await ticket_service.obtener(data.ticket_id, current, db)
        if ticket is None:
            raise RecursoNoEncontrado("Ticket no encontrado")

    tarea = TareaPendiente(
        usuario_id=current.id,
        texto=data.texto,
        ticket_id=data.ticket_id,
    )
    db.add(tarea)
    await db.commit()
    await db.refresh(tarea)

    ticket_titulo: str | None = None
    if tarea.ticket_id is not None:
        ticket = (
            await db.execute(select(Ticket).where(Ticket.id == tarea.ticket_id))
        ).scalar_one_or_none()
        ticket_titulo = ticket.titulo if ticket else None

    return TareaPendienteOut.model_validate(
        {
            **{k: getattr(tarea, k) for k in tarea.__table__.columns.keys()},
            "ticket_titulo": ticket_titulo,
        }
    )


async def actualizar(
    tarea_id: UUID,
    data: TareaPendienteUpdate,
    current: Usuario,
    db: AsyncSession,
) -> TareaPendienteOut:
    tarea = (
        await db.execute(
            select(TareaPendiente).where(
                TareaPendiente.id == tarea_id,
                TareaPendiente.usuario_id == current.id,
            )
        )
    ).scalar_one_or_none()
    if tarea is None:
        raise RecursoNoEncontrado("Tarea no encontrada")

    if data.texto is not None:
        tarea.texto = data.texto
    if data.completada is not None:
        tarea.completada = data.completada

    await db.commit()
    await db.refresh(tarea)

    ticket_titulo: str | None = None
    if tarea.ticket_id is not None:
        ticket = (
            await db.execute(select(Ticket).where(Ticket.id == tarea.ticket_id))
        ).scalar_one_or_none()
        ticket_titulo = ticket.titulo if ticket else None

    return TareaPendienteOut.model_validate(
        {
            **{k: getattr(tarea, k) for k in tarea.__table__.columns.keys()},
            "ticket_titulo": ticket_titulo,
        }
    )


async def eliminar(
    tarea_id: UUID,
    current: Usuario,
    db: AsyncSession,
) -> None:
    tarea = (
        await db.execute(
            select(TareaPendiente).where(
                TareaPendiente.id == tarea_id,
                TareaPendiente.usuario_id == current.id,
            )
        )
    ).scalar_one_or_none()
    if tarea is None:
        raise RecursoNoEncontrado("Tarea no encontrada")

    await db.delete(tarea)
    await db.commit()
