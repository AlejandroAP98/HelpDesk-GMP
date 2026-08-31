"""Servicio de eventos de calendario (programacion con recordatorio opcional)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.evento_calendario import EventoCalendario
from app.models.usuario import Usuario
from app.schemas.evento_calendario import (
    EventoCalendarioCreate,
    EventoCalendarioOut,
    EventoCalendarioUpdate,
)
from app.services import ticket_service
from app.utils.exceptions import Conflicto, RecursoNoEncontrado


async def listar(
    current: Usuario,
    db: AsyncSession,
    *,
    fecha_inicio: datetime | None = None,
    fecha_fin: datetime | None = None,
) -> list[EventoCalendarioOut]:
    """Lista eventos del usuario actual, opcionalmente filtrados por rango de fechas."""
    base = select(EventoCalendario).where(EventoCalendario.usuario_id == current.id)

    if fecha_inicio is not None:
        base = base.where(EventoCalendario.fecha_fin >= fecha_inicio)
    if fecha_fin is not None:
        base = base.where(EventoCalendario.fecha_inicio <= fecha_fin)

    base = base.order_by(EventoCalendario.fecha_inicio.asc())

    rows = (await db.execute(base)).scalars().all()
    return [EventoCalendarioOut.model_validate(e) for e in rows]


async def crear(
    data: EventoCalendarioCreate,
    current: Usuario,
    db: AsyncSession,
) -> EventoCalendarioOut:
    """Crea un nuevo evento de calendario."""
    if data.fecha_fin <= data.fecha_inicio:
        raise Conflicto("La fecha de fin debe ser posterior a la fecha de inicio")

    if data.ticket_id is not None:
        ticket = await ticket_service.obtener(data.ticket_id, current, db)
        if ticket is None:
            raise RecursoNoEncontrado("Ticket no encontrado")

    evento = EventoCalendario(
        usuario_id=current.id,
        titulo=data.titulo,
        descripcion=data.descripcion,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        recordar_email=data.recordar_email,
        minutos_antes=data.minutos_antes,
        ticket_id=data.ticket_id,
    )
    db.add(evento)
    await db.commit()
    await db.refresh(evento)

    return EventoCalendarioOut.model_validate(evento)


async def actualizar(
    evento_id: UUID,
    data: EventoCalendarioUpdate,
    current: Usuario,
    db: AsyncSession,
) -> EventoCalendarioOut:
    """Actualiza un evento existente."""
    evento = (
        await db.execute(
            select(EventoCalendario).where(
                EventoCalendario.id == evento_id,
                EventoCalendario.usuario_id == current.id,
            )
        )
    ).scalar_one_or_none()
    if evento is None:
        raise RecursoNoEncontrado("Evento no encontrado")

    if data.titulo is not None:
        evento.titulo = data.titulo
    if data.descripcion is not None:
        evento.descripcion = data.descripcion
    if data.fecha_inicio is not None:
        evento.fecha_inicio = data.fecha_inicio
    if data.fecha_fin is not None:
        evento.fecha_fin = data.fecha_fin
    if data.recordar_email is not None:
        evento.recordar_email = data.recordar_email
    if data.minutos_antes is not None:
        evento.minutos_antes = data.minutos_antes
    if data.ticket_id is not None:
        evento.ticket_id = data.ticket_id

    if evento.fecha_fin <= evento.fecha_inicio:
        raise Conflicto("La fecha de fin debe ser posterior a la fecha de inicio")

    await db.commit()
    await db.refresh(evento)

    return EventoCalendarioOut.model_validate(evento)


async def eliminar(
    evento_id: UUID,
    current: Usuario,
    db: AsyncSession,
) -> None:
    """Elimina un evento."""
    evento = (
        await db.execute(
            select(EventoCalendario).where(
                EventoCalendario.id == evento_id,
                EventoCalendario.usuario_id == current.id,
            )
        )
    ).scalar_one_or_none()
    if evento is None:
        raise RecursoNoEncontrado("Evento no encontrado")

    await db.delete(evento)
    await db.commit()
