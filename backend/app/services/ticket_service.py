"""Servicio CRUD y maquina de estados de Tickets."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import tenant_filter
from app.models.categoria import Categoria
from app.models.enums import EstadoTicket, PrioridadTicket, RolUsuario
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.ticket import (
    AsignacionRequest,
    EstadoUpdate,
    PrioridadUpdate,
    TicketCreate,
    TicketDetalle,
    TicketUpdate,
)
from app.services.estados import es_estado_final, es_transicion_valida
from app.utils.exceptions import Conflicto, PermisoDenegado, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion


_logger = __import__("logging").getLogger(__name__)


def _ticket_payload(ticket: Ticket, event_type: str) -> dict[str, object]:
    return {
        "type": event_type,
        "ticket_id": str(ticket.id),
        "empresa_id": ticket.empresa_id,
        "titulo": ticket.titulo,
        "prioridad": ticket.prioridad.value,
        "estado": ticket.estado.value,
        "cliente_id": str(ticket.cliente_id) if ticket.cliente_id else None,
        "agente_id": str(ticket.agente_id) if ticket.agente_id else None,
        "fecha_actualizacion": ticket.fecha_actualizacion.isoformat(),
    }


async def _publicar_urgente_si_corresponde(ticket: Ticket) -> None:
    from app.websockets.pubsub import publish_to_roles

    if ticket.prioridad != PrioridadTicket.urgente:
        return
    payload = _ticket_payload(ticket, "ticket:urgent_created")
    payload["prioridad"] = ticket.prioridad.value
    payload["estado"] = ticket.estado.value
    try:
        await publish_to_roles(
            roles=[RolUsuario.agente.value, RolUsuario.administrador.value],
            event=payload,
        )
    except Exception:
        _logger.warning("No se pudo publicar evento urgente", exc_info=True)


async def _publicar_evento_ticket(ticket: Ticket, event_type: str) -> None:
    from app.websockets.pubsub import publish_to_ticket, publish_broadcast

    payload = _ticket_payload(ticket, event_type)
    try:
        await publish_to_ticket(ticket.id, event=payload)
        await publish_broadcast(event=payload)
    except Exception:
        _logger.warning("No se pudo publicar %s para ticket %s", event_type, ticket.id, exc_info=True)


async def _get_categoria(categoria_id: int, db: AsyncSession) -> Categoria:
    cat = (
        await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    ).scalar_one_or_none()
    if cat is None:
        raise RecursoNoEncontrado(f"Categoria {categoria_id} no existe")
    return cat


async def _get_agente(agente_id: UUID, db: AsyncSession) -> Usuario:
    agente = (
        await db.execute(
            select(Usuario).where(
                Usuario.id == agente_id,
                Usuario.rol.in_([RolUsuario.agente, RolUsuario.administrador]),
            )
        )
    ).scalar_one_or_none()
    if agente is None:
        raise RecursoNoEncontrado("Agente no encontrado o no tiene rol valido")
    return agente


async def crear(
    data: TicketCreate, current: Usuario, db: AsyncSession
) -> Ticket:
    """Cliente crea ticket; agente/admin pueden crear a nombre de cualquier empresa."""
    if current.rol == RolUsuario.cliente.value:
        if current.empresa_id is None:
            raise Conflicto("Cliente sin empresa asignada")
        empresa_id = current.empresa_id
    else:
        if current.empresa_id is None:
            raise Conflicto("Indica empresa_id mediante tu perfil o usa el endpoint admin")
        empresa_id = current.empresa_id

    await _get_categoria(data.categoria_id, db)

    ticket = Ticket(
        empresa_id=empresa_id,
        cliente_id=current.id,
        titulo=data.titulo,
        descripcion=data.descripcion,
        categoria_id=data.categoria_id,
        prioridad=data.prioridad,
        estado=EstadoTicket.abierto,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    await _publicar_urgente_si_corresponde(ticket)
    await _publicar_evento_ticket(ticket, "ticket:created")
    return ticket


async def crear_admin(
    data: TicketCreate,
    empresa_id: int,
    cliente_id: UUID,
    db: AsyncSession,
) -> Ticket:
    """Admin crea ticket a nombre de un cliente y empresa especificos."""
    cliente = (
        await db.execute(
            select(Usuario).where(
                Usuario.id == cliente_id,
                Usuario.rol == RolUsuario.cliente,
                Usuario.empresa_id == empresa_id,
            )
        )
    ).scalar_one_or_none()
    if cliente is None:
        raise RecursoNoEncontrado("Cliente no encontrado en esa empresa")
    await _get_categoria(data.categoria_id, db)

    ticket = Ticket(
        empresa_id=empresa_id,
        cliente_id=cliente_id,
        titulo=data.titulo,
        descripcion=data.descripcion,
        categoria_id=data.categoria_id,
        prioridad=data.prioridad,
        estado=EstadoTicket.abierto,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    await _publicar_urgente_si_corresponde(ticket)
    await _publicar_evento_ticket(ticket, "ticket:created")
    return ticket


async def listar(
    current: Usuario,
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    estado: EstadoTicket | None = None,
    prioridad: PrioridadTicket | None = None,
    empresa_id: int | None = None,
    agente_id: UUID | None = None,
    cliente_id: UUID | None = None,
) -> Pagina[Ticket]:
    p = paginacion(page, size)
    base = select(Ticket)
    count_base = select(func.count(Ticket.id))

    tf = tenant_filter(current)
    if "empresa_id" in tf:
        base = base.where(Ticket.empresa_id == tf["empresa_id"])
        count_base = count_base.where(Ticket.empresa_id == tf["empresa_id"])

    if current.rol == RolUsuario.agente.value and agente_id is None:
        base = base.where(Ticket.agente_id == current.id)
        count_base = count_base.where(Ticket.agente_id == current.id)

    if estado is not None:
        base = base.where(Ticket.estado == estado)
        count_base = count_base.where(Ticket.estado == estado)
    if prioridad is not None:
        base = base.where(Ticket.prioridad == prioridad)
        count_base = count_base.where(Ticket.prioridad == prioridad)
    if empresa_id is not None and current.rol != RolUsuario.cliente.value:
        base = base.where(Ticket.empresa_id == empresa_id)
        count_base = count_base.where(Ticket.empresa_id == empresa_id)
    if agente_id is not None:
        base = base.where(Ticket.agente_id == agente_id)
        count_base = count_base.where(Ticket.agente_id == agente_id)
    if cliente_id is not None:
        base = base.where(Ticket.cliente_id == cliente_id)
        count_base = count_base.where(Ticket.cliente_id == cliente_id)

    total = (await db.execute(count_base)).scalar_one()
    items = (
        await db.execute(
            base.order_by(Ticket.fecha_creacion.desc()).offset(p.offset).limit(p.limit)
        )
    ).scalars().all()
    return Pagina.of(list(items), total, p.page, p.size)


async def obtener(
    ticket_id: UUID, current: Usuario, db: AsyncSession
) -> Ticket:
    ticket = (
        await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ).scalar_one_or_none()
    if ticket is None:
        raise RecursoNoEncontrado(f"Ticket {ticket_id} no existe")
    tf = tenant_filter(current)
    if "empresa_id" in tf and ticket.empresa_id != tf["empresa_id"]:
        raise RecursoNoEncontrado(f"Ticket {ticket_id} no existe")
    return ticket


async def actualizar(
    ticket_id: UUID, data: TicketUpdate, current: Usuario, db: AsyncSession
) -> Ticket:
    ticket = await obtener(ticket_id, current, db)
    if es_estado_final(ticket.estado):
        raise Conflicto("Ticket cerrado, no se puede editar")
    if current.rol == RolUsuario.cliente.value and ticket.cliente_id != current.id:
        raise PermisoDenegado("Solo el autor puede editar su ticket")
    if data.categoria_id is not None:
        await _get_categoria(data.categoria_id, db)
    for field in ("titulo", "descripcion", "categoria_id", "prioridad"):
        val = getattr(data, field)
        if val is not None:
            setattr(ticket, field, val)
    await db.commit()
    await db.refresh(ticket)
    await _publicar_evento_ticket(ticket, "ticket:updated")
    return ticket


async def asignar(
    ticket_id: UUID, data: AsignacionRequest, current: Usuario, db: AsyncSession
) -> Ticket:
    """Admin asigna agente a un ticket abierto. Transicion abierto -> asignado."""
    if current.rol != RolUsuario.administrador.value:
        raise PermisoDenegado("Solo administradores pueden asignar tickets")
    ticket = await obtener(ticket_id, current, db)
    agente = await _get_agente(data.agente_id, db)

    if ticket.estado != EstadoTicket.abierto:
        raise Conflicto(f"Ticket en estado {ticket.estado.value} no es asignable")
    if agente.empresa_id is not None and agente.empresa_id != ticket.empresa_id:
        raise Conflicto("El agente pertenece a otra empresa")

    ticket.agente_id = agente.id
    ticket.estado = EstadoTicket.asignado
    await db.commit()
    await db.refresh(ticket)
    await _publicar_evento_ticket(ticket, "ticket:updated")
    return ticket


async def cambiar_estado(
    ticket_id: UUID, data: EstadoUpdate, current: Usuario, db: AsyncSession
) -> Ticket:
    """Transiciona el estado validando la maquina de estados y permisos."""
    ticket = await obtener(ticket_id, current, db)
    nuevo = data.estado
    if not es_transicion_valida(ticket.estado, nuevo):
        raise Conflicto(
            f"Transicion invalida: {ticket.estado.value} -> {nuevo.value}"
        )

    if nuevo == EstadoTicket.en_progreso:
        if current.rol == RolUsuario.cliente.value:
            raise PermisoDenegado("Solo agentes/admins pueden progresar un ticket")
        if ticket.agente_id is None:
            raise Conflicto("Ticket sin agente asignado")
        if (
            current.rol == RolUsuario.agente.value
            and ticket.agente_id != current.id
            and current.rol != RolUsuario.administrador.value
        ):
            raise PermisoDenegado("Solo el agente asignado puede progresar el ticket")

    elif nuevo == EstadoTicket.resuelto:
        if current.rol == RolUsuario.cliente.value:
            raise PermisoDenegado("Solo agentes/admins pueden resolver tickets")
        if ticket.agente_id is None:
            raise Conflicto("Ticket sin agente asignado")
        if (
            current.rol == RolUsuario.agente.value
            and ticket.agente_id != current.id
        ):
            raise PermisoDenegado("Solo el agente asignado puede resolver el ticket")

    elif nuevo == EstadoTicket.cerrado:
        if current.rol == RolUsuario.administrador.value:
            pass
        elif current.rol == RolUsuario.cliente.value and ticket.cliente_id == current.id:
            pass
        elif current.rol == RolUsuario.agente.value and ticket.agente_id == current.id:
            pass
        else:
            raise PermisoDenegado("No tienes permiso para cerrar este ticket")

    ticket.estado = nuevo
    await db.commit()
    await db.refresh(ticket)
    await _publicar_evento_ticket(ticket, "ticket:updated")
    return ticket


async def cambiar_prioridad(
    ticket_id: UUID, data: PrioridadUpdate, current: Usuario, db: AsyncSession
) -> Ticket:
    ticket = await obtener(ticket_id, current, db)
    if es_estado_final(ticket.estado):
        raise Conflicto("Ticket cerrado, no se puede cambiar prioridad")
    if current.rol == RolUsuario.cliente.value and ticket.cliente_id != current.id:
        raise PermisoDenegado("Solo el autor puede cambiar prioridad")
    ticket.prioridad = data.prioridad
    await db.commit()
    await db.refresh(ticket)
    await _publicar_evento_ticket(ticket, "ticket:updated")
    return ticket


async def reabrir(ticket_id: UUID, current: Usuario, db: AsyncSession) -> Ticket:
    """Permite reabrir un ticket cerrado: vuelve a abierto. Solo admin."""
    if current.rol != RolUsuario.administrador.value:
        raise PermisoDenegado("Solo administradores pueden reabrir tickets")
    ticket = await obtener(ticket_id, current, db)
    if ticket.estado != EstadoTicket.cerrado:
        raise Conflicto("Solo tickets cerrados pueden reabrirse")
    ticket.estado = EstadoTicket.abierto
    ticket.agente_id = None
    await db.commit()
    await db.refresh(ticket)
    await _publicar_evento_ticket(ticket, "ticket:updated")
    return ticket