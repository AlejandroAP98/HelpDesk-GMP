"""Servicio CRUD y maquina de estados de Tickets."""
from __future__ import annotations

from datetime import timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import tenant_filter
from app.models.categoria import Categoria
from app.models.enums import EstadoTicket, PrioridadTicket, RolUsuario, VistaTicket
from app.models.historial_estado import HistorialEstado
from app.models.subcategoria import Subcategoria
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.ticket import (
    AsignacionRequest,
    EstadoUpdate,
    HistorialEstadoOut,
    PrioridadUpdate,
    TicketCreate,
    TicketDetalle,
    TicketUpdate,
)
from app.services.estados import es_estado_final, es_transicion_valida
from app.services.prioridad import calcular_prioridad
from app.utils.exceptions import Conflicto, PermisoDenegado, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion
from sqlalchemy import case

_logger = __import__("logging").getLogger(__name__)

VISTA_ESTADOS: dict[VistaTicket, list[EstadoTicket]] = {
    VistaTicket.activos: [EstadoTicket.abierto, EstadoTicket.asignado, EstadoTicket.en_progreso],
    VistaTicket.historial: [EstadoTicket.resuelto, EstadoTicket.cerrado],
    VistaTicket.todos: [],
}


async def _registrar_historial(
    ticket_id: UUID,
    usuario_id: UUID,
    estado_anterior: EstadoTicket,
    estado_nuevo: EstadoTicket,
    db: AsyncSession,
) -> None:
    entry = HistorialEstado(
        ticket_id=ticket_id,
        usuario_id=usuario_id,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
    )
    db.add(entry)


async def listar_historial(
    ticket_id: UUID, current: Usuario, db: AsyncSession,
    page: int = 1, size: int = 20,
) -> Pagina[HistorialEstadoOut]:
    ticket = await obtener(ticket_id, current, db)
    p = paginacion(page, size)
    base = (
        select(HistorialEstado, Usuario.nombre)
        .join(Usuario, HistorialEstado.usuario_id == Usuario.id, isouter=True)
        .where(HistorialEstado.ticket_id == ticket.id)
    )
    count_base = select(func.count(HistorialEstado.id)).where(
        HistorialEstado.ticket_id == ticket.id
    )
    total = (await db.execute(count_base)).scalar_one()
    rows = (
        await db.execute(
            base.order_by(HistorialEstado.fecha.asc())
            .offset(p.offset)
            .limit(p.limit)
        )
    ).all()
    items = [
        HistorialEstadoOut(
            id=h.id,
            ticket_id=h.ticket_id,
            usuario_id=h.usuario_id,
            usuario_nombre=nombre,
            estado_anterior=h.estado_anterior,
            estado_nuevo=h.estado_nuevo,
            fecha=h.fecha,
        )
        for h, nombre in rows
    ]
    return Pagina.of(items, total, p.page, p.size)


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
        "fecha_actualizacion": ticket.fecha_actualizacion.replace(tzinfo=timezone.utc).isoformat(),
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
        _logger.info(
            "Evento %s publicado para ticket %s (empresa=%s)",
            event_type,
            ticket.id,
            ticket.empresa_id,
        )
    except Exception:
        _logger.warning("No se pudo publicar %s para ticket %s", event_type, ticket.id, exc_info=True)


async def _get_categoria(categoria_id: int, db: AsyncSession) -> Categoria:
    cat = (
        await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    ).scalar_one_or_none()
    if cat is None:
        raise RecursoNoEncontrado(f"Categoria {categoria_id} no existe")
    return cat


async def _get_subcategoria(subcategoria_id: int, categoria_id: int, db: AsyncSession) -> Subcategoria:
    sub = (
        await db.execute(
            select(Subcategoria).where(
                Subcategoria.id == subcategoria_id,
                Subcategoria.categoria_id == categoria_id,
            )
        )
    ).scalar_one_or_none()
    if sub is None:
        raise RecursoNoEncontrado(
            f"Subcategoría {subcategoria_id} no existe o no pertenece a la categoría {categoria_id}"
        )
    return sub


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
    await _get_subcategoria(data.subcategoria_id, data.categoria_id, db)
    prioridad = await calcular_prioridad(
        data.categoria_id, data.subcategoria_id, data.elemento_afectado, db
    )

    ticket = Ticket(
        empresa_id=empresa_id,
        cliente_id=current.id,
        titulo=data.titulo,
        descripcion=data.descripcion,
        categoria_id=data.categoria_id,
        subcategoria_id=data.subcategoria_id,
        elemento_afectado=data.elemento_afectado,
        ip_pcs=data.ip_pcs,
        ip_antena=data.ip_antena,
        mascara_red=data.mascara_red,
        puerta_enlace=data.puerta_enlace,
        nombre_punto=data.nombre_punto,
        prioridad=prioridad,
        estado=EstadoTicket.abierto,
        modificado_por_id=current.id,
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
    await _get_subcategoria(data.subcategoria_id, data.categoria_id, db)
    prioridad = await calcular_prioridad(
        data.categoria_id, data.subcategoria_id, data.elemento_afectado, db
    )

    ticket = Ticket(
        empresa_id=empresa_id,
        cliente_id=cliente_id,
        titulo=data.titulo,
        descripcion=data.descripcion,
        categoria_id=data.categoria_id,
        subcategoria_id=data.subcategoria_id,
        elemento_afectado=data.elemento_afectado,
        ip_pcs=data.ip_pcs,
        ip_antena=data.ip_antena,
        mascara_red=data.mascara_red,
        puerta_enlace=data.puerta_enlace,
        nombre_punto=data.nombre_punto,
        prioridad=prioridad,
        estado=EstadoTicket.abierto,
        modificado_por_id=None,
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
    vista: VistaTicket | None = None,
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

    if vista is not None:
        estados_vista = VISTA_ESTADOS.get(vista, [])
        if estados_vista:
            base = base.where(Ticket.estado.in_(estados_vista))
            count_base = count_base.where(Ticket.estado.in_(estados_vista))

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

    # 1. Creamos una escala de peso para las prioridades (Menor número = Más arriba)
    peso_prioridad = case(
        (Ticket.prioridad == "urgente", 1),
        (Ticket.prioridad == "alta", 2),
        (Ticket.prioridad == "media", 3),
        (Ticket.prioridad == "baja", 4),
        else_=5
    )

    # 2. Opcional: Separamos el ciclo de vida (Activos primero, cerrados al fondo)
    peso_estado = case(
        (Ticket.estado == "en_progreso", 1),
        (Ticket.estado == "asignado", 2),
        (Ticket.estado == "abierto", 3),
        (Ticket.estado == "resuelto", 4),
        (Ticket.estado == "cerrado", 5),
        else_=6
    )

    # Ejecución de la consulta modificando el ordenamiento
    total = (await db.execute(count_base)).scalar_one()
    items = (
        await db.execute(
            base.order_by(
                peso_estado.asc(),           # 1° Estados que requieren acción primero
                peso_prioridad.asc(),        # 2° Lo más urgente arriba de cada estado
                Ticket.fecha_creacion.asc()  # 3° El que más tiempo lleva esperando (SLA)
            )
            .offset(p.offset)
            .limit(p.limit)
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


async def obtener_detalle(
    ticket_id: UUID, current: Usuario, db: AsyncSession
) -> TicketDetalle:
    ticket = await obtener(ticket_id, current, db)
    cliente_nombre: str | None = None
    agente_nombre: str | None = None
    modificado_por_nombre: str | None = None
    subcategoria_nombre: str | None = None
    usuario_ids = {ticket.cliente_id, ticket.agente_id, ticket.modificado_por_id}
    usuario_ids.discard(None)
    if usuario_ids:
        rows = (
            await db.execute(
                select(Usuario.id, Usuario.nombre).where(Usuario.id.in_(usuario_ids))
            )
        ).all()
        nombres = {uid: nombre for uid, nombre in rows}
        cliente_nombre = nombres.get(ticket.cliente_id)
        agente_nombre = nombres.get(ticket.agente_id)
        modificado_por_nombre = nombres.get(ticket.modificado_por_id)
    sub = (
        await db.execute(
            select(Subcategoria.nombre).where(Subcategoria.id == ticket.subcategoria_id)
        )
    ).scalar_one_or_none()
    subcategoria_nombre = sub
    return TicketDetalle(
        id=ticket.id,
        empresa_id=ticket.empresa_id,
        cliente_id=ticket.cliente_id,
        agente_id=ticket.agente_id,
        modificado_por_id=ticket.modificado_por_id,
        categoria_id=ticket.categoria_id,
        subcategoria_id=ticket.subcategoria_id,
        elemento_afectado=ticket.elemento_afectado,
        titulo=ticket.titulo,
        descripcion=ticket.descripcion,
        ip_pcs=ticket.ip_pcs,
        ip_antena=ticket.ip_antena,
        mascara_red=ticket.mascara_red,
        puerta_enlace=ticket.puerta_enlace,
        nombre_punto=ticket.nombre_punto,
        estado=ticket.estado,
        prioridad=ticket.prioridad,
        fecha_creacion=ticket.fecha_creacion,
        fecha_actualizacion=ticket.fecha_actualizacion,
        cliente_nombre=cliente_nombre,
        agente_nombre=agente_nombre,
        modificado_por_nombre=modificado_por_nombre,
        subcategoria_nombre=subcategoria_nombre,
    )


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
    for field in ("titulo", "descripcion", "categoria_id", "prioridad", "ip_pcs", "ip_antena", "mascara_red", "puerta_enlace", "nombre_punto"):
        val = getattr(data, field)
        if val is not None:
            setattr(ticket, field, val)
    ticket.modificado_por_id = current.id
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
    ticket.modificado_por_id = current.id
    await _registrar_historial(ticket.id, current.id, EstadoTicket.abierto, EstadoTicket.asignado, db)
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

    estado_anterior = ticket.estado
    ticket.estado = nuevo
    ticket.modificado_por_id = current.id
    await _registrar_historial(ticket.id, current.id, estado_anterior, nuevo, db)
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
    ticket.modificado_por_id = current.id
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
    ticket.modificado_por_id = current.id
    await _registrar_historial(ticket.id, current.id, EstadoTicket.cerrado, EstadoTicket.abierto, db)
    await db.commit()
    await db.refresh(ticket)
    await _publicar_evento_ticket(ticket, "ticket:updated")
    return ticket