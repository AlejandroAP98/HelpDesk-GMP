"""Servicio CRUD y maquina de estados de Tickets."""

from __future__ import annotations

from datetime import date, timezone
from uuid import UUID, uuid4

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import tenant_filter
from app.models.categoria import Categoria
from app.models.empresa import Empresa
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
    ticket_id: UUID,
    current: Usuario,
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
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
        await db.execute(base.order_by(HistorialEstado.fecha.asc()).offset(p.offset).limit(p.limit))
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


def _ticket_payload(ticket: Ticket, event_type: str, empresa_nombre: str | None = None) -> dict[str, object]:
    return {
        "type": event_type,
        "event_id": str(uuid4()),
        "ticket_id": str(ticket.id),
        "empresa_id": ticket.empresa_id,
        "empresa_nombre": empresa_nombre,
        "titulo": ticket.titulo,
        "prioridad": ticket.prioridad.value,
        "estado": ticket.estado.value,
        "categoria_id": ticket.categoria_id,
        "subcategoria_id": ticket.subcategoria_id,
        "elemento_afectado": ticket.elemento_afectado.value,
        "nombre_punto": ticket.nombre_punto,
        "cliente_id": str(ticket.cliente_id) if ticket.cliente_id else None,
        "agente_id": str(ticket.agente_id) if ticket.agente_id else None,
        "fecha_actualizacion": ticket.fecha_actualizacion.replace(tzinfo=timezone.utc).isoformat(),
    }


async def _enviar_emails_post_creacion(
    ticket: Ticket,
    cliente: Usuario,
    empresa_nombre: str | None,
) -> None:
    """Lanza los emails transaccionales que se disparan al crear un ticket.
    Fire-and-forget: si falla el envio, no afecta la creacion del ticket."""
    import asyncio

    from app.services import email_service

    if not cliente.notificaciones_email:
        return

    async def _run() -> None:
        try:
            await email_service.send_ticket_created(ticket, cliente.email)
            if ticket.prioridad == PrioridadTicket.urgente:
                await email_service.send_ticket_urgent(ticket, empresa_nombre)
        except Exception:
            _logger.exception("Error enviando emails post-creacion para ticket %s", ticket.id)

    asyncio.create_task(_run())


async def _publicar_urgente_si_corresponde(ticket: Ticket, empresa_nombre: str | None = None) -> None:
    from app.websockets.pubsub import publish_to_roles

    if ticket.prioridad != PrioridadTicket.urgente:
        return
    payload = _ticket_payload(ticket, "ticket:urgent_created", empresa_nombre)
    payload["prioridad"] = ticket.prioridad.value
    payload["estado"] = ticket.estado.value
    try:
        await publish_to_roles(
            roles=[
                RolUsuario.mesa_ayuda.value,
                RolUsuario.administrador.value,
            ],
            event=payload,
        )
    except Exception:
        _logger.warning("No se pudo publicar evento urgente", exc_info=True)


async def _publicar_evento_ticket(ticket: Ticket, event_type: str, empresa_nombre: str | None = None) -> None:
    from app.websockets.pubsub import publish_broadcast

    payload = _ticket_payload(ticket, event_type, empresa_nombre)
    try:
        await publish_broadcast(event=payload)
        _logger.info(
            "Evento %s publicado para ticket %s (empresa=%s)",
            event_type,
            ticket.id,
            ticket.empresa_id,
        )
    except Exception:
        _logger.warning(
            "No se pudo publicar %s para ticket %s", event_type, ticket.id, exc_info=True
        )


async def _publicar_cambio_estado(ticket: Ticket, estado_anterior: str, empresa_nombre: str | None = None) -> None:
    from app.websockets.pubsub import publish_broadcast

    payload = _ticket_payload(ticket, "ticket:state_changed", empresa_nombre)
    payload["estado_anterior"] = estado_anterior
    payload["estado_nuevo"] = ticket.estado.value
    try:
        await publish_broadcast(event=payload)
        _logger.info(
            "Evento ticket:state_changed publicado para ticket %s: %s -> %s",
            ticket.id,
            estado_anterior,
            ticket.estado.value,
        )
    except Exception:
        _logger.warning(
            "No se pudo publicar ticket:state_changed para ticket %s",
            ticket.id,
            exc_info=True,
        )


async def _publicar_nuevo_ticket(ticket: Ticket, empresa_nombre: str | None = None) -> None:
    """Publica evento ticket:new a mesa de ayuda + administrador.

    Estos roles monitorean y asignan tickets constantemente, por lo que
    reciben una alerta visual por cada nuevo ticket creado (sin importar prioridad).
    El evento ticket:urgent_created sigue disparandose aparte para urgentes
    con beep rojo diferenciado.
    """
    from app.websockets.pubsub import publish_to_roles

    payload = _ticket_payload(ticket, "ticket:new", empresa_nombre)
    payload["cliente_nombre"] = None
    try:
        await publish_to_roles(
            roles=[
                RolUsuario.mesa_ayuda.value,
                RolUsuario.administrador.value,
            ],
            event=payload,
        )
    except Exception:
        _logger.warning(
            "No se pudo publicar ticket:new para ticket %s", ticket.id, exc_info=True
        )


async def _publicar_asignacion(ticket: Ticket, empresa_nombre: str | None = None) -> None:
    """Publica evento ticket:assigned (dispara Web Push al agente asignado).

    Se publica solo a roles agente+mesa_ayuda+administrador via publish_to_roles.
    El agente asignado recibe la notificacion por su rol; los usuarios en la sala
    del ticket reciben la actualizacion via ticket:updated (broadcast).
    """
    from app.websockets.pubsub import publish_to_roles

    if ticket.agente_id is None:
        return
    payload = _ticket_payload(ticket, "ticket:assigned", empresa_nombre)
    try:
        await publish_to_roles(
            roles=[
                RolUsuario.agente.value,
                RolUsuario.mesa_ayuda.value,
                RolUsuario.administrador.value,
            ],
            event=payload,
        )
    except Exception:
        _logger.warning("No se pudo publicar ticket:assigned para %s", ticket.id, exc_info=True)


async def _get_categoria(categoria_id: int, db: AsyncSession) -> Categoria:
    cat = (
        await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    ).scalar_one_or_none()
    if cat is None:
        raise RecursoNoEncontrado(f"Categoria {categoria_id} no existe")
    return cat


async def _get_subcategoria(
    subcategoria_id: int, categoria_id: int, db: AsyncSession
) -> Subcategoria:
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
    """Resuelve un usuario que puede recibir tickets asignados.

    Roles validos: agente, mesa_ayuda, administrador. (mesa_ayuda y administrador
    pueden recibir self-assign para resolver ellos mismos sin pasar por un agente.)
    """
    agente = (
        await db.execute(
            select(Usuario).where(
                Usuario.id == agente_id,
                Usuario.rol.in_([
                    RolUsuario.agente,
                    RolUsuario.mesa_ayuda,
                    RolUsuario.administrador,
                ]),
            )
        )
    ).scalar_one_or_none()
    if agente is None:
        raise RecursoNoEncontrado("Agente no encontrado o no tiene rol valido")
    return agente


async def crear(data: TicketCreate, current: Usuario, db: AsyncSession) -> Ticket:
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
    empresa_nombre = (await db.execute(
        select(Empresa.nombre).where(Empresa.id == empresa_id)
    )).scalar_one_or_none()
    await _publicar_urgente_si_corresponde(ticket, empresa_nombre)
    await _publicar_evento_ticket(ticket, "ticket:created", empresa_nombre)
    await _publicar_nuevo_ticket(ticket, empresa_nombre)
    await _enviar_emails_post_creacion(ticket, current, empresa_nombre)
    from app.services import actividad_service
    await actividad_service.registrar(
        empresa_id=ticket.empresa_id,
        usuario_id=current.id,
        usuario_nombre=current.nombre,
        ticket_id=ticket.id,
        tipo_evento="ticket_created",
        metadata={"titulo": ticket.titulo, "prioridad": ticket.prioridad.value},
    )
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
    empresa_nombre = (await db.execute(
        select(Empresa.nombre).where(Empresa.id == empresa_id)
    )).scalar_one_or_none()
    await _publicar_urgente_si_corresponde(ticket, empresa_nombre)
    await _publicar_evento_ticket(ticket, "ticket:created", empresa_nombre)
    await _publicar_nuevo_ticket(ticket, empresa_nombre)
    await _enviar_emails_post_creacion(ticket, cliente, empresa_nombre)
    from app.services import actividad_service
    await actividad_service.registrar(
        empresa_id=ticket.empresa_id,
        usuario_id=cliente.id,
        usuario_nombre=cliente.nombre,
        ticket_id=ticket.id,
        tipo_evento="ticket_created",
        metadata={"titulo": ticket.titulo, "prioridad": ticket.prioridad.value},
    )
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
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    orden: str | None = None,
    q: str | None = None,
) -> Pagina[tuple[Ticket, str | None, str | None]]:
    from datetime import datetime, time, timezone

    p = paginacion(page, size)
    base = (
        select(Ticket, Empresa.nombre.label("empresa_nombre"), Usuario.nombre.label("agente_nombre"))
        .outerjoin(Empresa, Ticket.empresa_id == Empresa.id)
        .outerjoin(Usuario, Ticket.agente_id == Usuario.id)
    )
    count_base = select(func.count(Ticket.id))

    tf = tenant_filter(current)
    if "empresa_id" in tf:
        base = base.where(Ticket.empresa_id == tf["empresa_id"])
        count_base = count_base.where(Ticket.empresa_id == tf["empresa_id"])

    if current.rol == RolUsuario.agente.value:
        base = base.where(Ticket.agente_id == current.id)
        count_base = count_base.where(Ticket.agente_id == current.id)
    elif agente_id is not None:
        base = base.where(Ticket.agente_id == agente_id)
        count_base = count_base.where(Ticket.agente_id == agente_id)

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
    if cliente_id is not None:
        base = base.where(Ticket.cliente_id == cliente_id)
        count_base = count_base.where(Ticket.cliente_id == cliente_id)

    if fecha_inicio is not None:
        dt_inicio = datetime.combine(fecha_inicio, time.min, tzinfo=timezone.utc).replace(tzinfo=None)
        base = base.where(Ticket.fecha_creacion >= dt_inicio)
        count_base = count_base.where(Ticket.fecha_creacion >= dt_inicio)
    if fecha_fin is not None:
        dt_fin = datetime.combine(fecha_fin, time.max, tzinfo=timezone.utc).replace(tzinfo=None)
        base = base.where(Ticket.fecha_creacion <= dt_fin)
        count_base = count_base.where(Ticket.fecha_creacion <= dt_fin)

    if q and len(q.strip()) >= 2:
        q_stripped = q.strip().lstrip("#")
        if q_stripped and all(c in "0123456789abcdefABCDEF" for c in q_stripped) and len(q_stripped) <= 36:
            filtro_id = cast(Ticket.id, String).ilike(f"{q_stripped}%")
            base = base.where(filtro_id)
            count_base = count_base.where(filtro_id)
        else:
            like = f"%{q.strip()}%"
            filtro_titulo = Ticket.titulo.ilike(like)
            base = base.where(filtro_titulo)
            count_base = count_base.where(filtro_titulo)

    peso_prioridad = case(
        (Ticket.prioridad == "urgente", 1),
        (Ticket.prioridad == "alta", 2),
        (Ticket.prioridad == "media", 3),
        (Ticket.prioridad == "baja", 4),
        else_=5,
    )

    peso_estado = case(
        (Ticket.estado == "en_progreso", 1),
        (Ticket.estado == "asignado", 2),
        (Ticket.estado == "abierto", 3),
        (Ticket.estado == "resuelto", 4),
        (Ticket.estado == "cerrado", 5),
        else_=6,
    )

    total = (await db.execute(count_base)).scalar_one()
    
    if orden == "fecha":
        query = base.order_by(Ticket.fecha_creacion.desc())
    else:
        query = base.order_by(peso_estado.asc(), peso_prioridad.asc(), Ticket.fecha_creacion.asc())
    
    rows = (
        await db.execute(
            query.offset(p.offset).limit(p.limit)
        )
    ).all()

    items = [(ticket, emp_nombre, agente_nombre) for ticket, emp_nombre, agente_nombre in rows]
    return Pagina.of(items, total, p.page, p.size)


async def obtener(ticket_id: UUID, current: Usuario, db: AsyncSession) -> Ticket:
    ticket = (await db.execute(select(Ticket).where(Ticket.id == ticket_id))).scalar_one_or_none()
    if ticket is None:
        raise RecursoNoEncontrado(f"Ticket {ticket_id} no existe")
    tf = tenant_filter(current)
    if "empresa_id" in tf and ticket.empresa_id != tf["empresa_id"]:
        raise RecursoNoEncontrado(f"Ticket {ticket_id} no existe")
    if current.rol == RolUsuario.agente.value and ticket.agente_id != current.id:
        raise RecursoNoEncontrado(f"Ticket {ticket_id} no existe")
    return ticket


async def obtener_detalle(ticket_id: UUID, current: Usuario, db: AsyncSession) -> TicketDetalle:
    ticket = await obtener(ticket_id, current, db)
    cliente_nombre: str | None = None
    agente_nombre: str | None = None
    modificado_por_nombre: str | None = None
    subcategoria_nombre: str | None = None
    empresa_nombre: str | None = None
    usuario_ids = {ticket.cliente_id, ticket.agente_id, ticket.modificado_por_id}
    usuario_ids.discard(None)
    if usuario_ids:
        rows = (
            await db.execute(select(Usuario.id, Usuario.nombre).where(Usuario.id.in_(usuario_ids)))
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
    emp = (
        await db.execute(select(Empresa.nombre).where(Empresa.id == ticket.empresa_id))
    ).scalar_one_or_none()
    empresa_nombre = emp
    return TicketDetalle(
        id=ticket.id,
        empresa_id=ticket.empresa_id,
        empresa_nombre=empresa_nombre,
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
        fecha_asignacion=ticket.fecha_asignacion,
        fecha_primera_respuesta=ticket.fecha_primera_respuesta,
        fecha_resolucion=ticket.fecha_resolucion,
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
    if current.rol == RolUsuario.agente.value and ticket.agente_id != current.id:
        raise PermisoDenegado("Solo el agente asignado puede editar el ticket")
    if data.categoria_id is not None:
        await _get_categoria(data.categoria_id, db)
    for field in (
        "titulo",
        "descripcion",
        "categoria_id",
        "prioridad",
        "ip_pcs",
        "ip_antena",
        "mascara_red",
        "puerta_enlace",
        "nombre_punto",
    ):
        val = getattr(data, field)
        if val is not None:
            setattr(ticket, field, val)
    ticket.modificado_por_id = current.id
    await db.commit()
    await db.refresh(ticket)
    empresa_nombre = (await db.execute(
        select(Empresa.nombre).where(Empresa.id == ticket.empresa_id)
    )).scalar_one_or_none()
    await _publicar_evento_ticket(ticket, "ticket:updated", empresa_nombre)
    return ticket


async def _asignar_a(
    ticket: Ticket,
    agente: Usuario,
    current: Usuario,
    db: AsyncSession,
) -> Ticket:
    """Core de la transicion abierto -> asignado o reasignacion. Usado por asignar() y asignarme()."""
    estado_anterior = ticket.estado
    if estado_anterior not in (EstadoTicket.abierto, EstadoTicket.asignado, EstadoTicket.en_progreso):
        raise Conflicto(f"Ticket en estado {estado_anterior.value} no es asignable")
    if agente.empresa_id is not None and agente.empresa_id != ticket.empresa_id:
        raise Conflicto("El agente pertenece a otra empresa")

    ticket.agente_id = agente.id
    ticket.estado = EstadoTicket.asignado
    ticket.modificado_por_id = current.id
    if ticket.fecha_asignacion is None:
        ticket.fecha_asignacion = func.now()
    await _registrar_historial(
        ticket.id, current.id, estado_anterior, EstadoTicket.asignado, db
    )
    await db.commit()
    await db.refresh(ticket)
    empresa_nombre = (await db.execute(
        select(Empresa.nombre).where(Empresa.id == ticket.empresa_id)
    )).scalar_one_or_none()
    await _publicar_evento_ticket(ticket, "ticket:updated", empresa_nombre)
    await _publicar_asignacion(ticket, empresa_nombre)
    if estado_anterior != EstadoTicket.asignado:
        await _publicar_cambio_estado(ticket, estado_anterior, empresa_nombre)
    from app.services import actividad_service
    await actividad_service.registrar(
        empresa_id=ticket.empresa_id,
        usuario_id=current.id,
        usuario_nombre=current.nombre,
        ticket_id=ticket.id,
        tipo_evento="ticket_assigned",
        metadata={"agente_id": str(agente.id), "agente_nombre": agente.nombre},
    )
    return ticket


async def asignar(
    ticket_id: UUID, data: AsignacionRequest, current: Usuario, db: AsyncSession
) -> Ticket:
    """Admin o mesa de ayuda asigna agente a un ticket abierto. Transicion abierto -> asignado."""
    if current.rol not in (
        RolUsuario.administrador.value,
        RolUsuario.mesa_ayuda.value,
    ):
        raise PermisoDenegado("Solo administradores o mesa de ayuda pueden asignar tickets")
    ticket = await obtener(ticket_id, current, db)
    agente = await _get_agente(data.agente_id, db)
    return await _asignar_a(ticket, agente, current, db)


async def asignarme(
    ticket_id: UUID, current: Usuario, db: AsyncSession
) -> Ticket:
    """Admin o mesa de ayuda se autoasigna un ticket abierto.

    Util cuando mesa de ayuda/admin resuelven ellos mismos sin pasar por un agente.
    Transicion abierto -> asignado. El usuario actual queda como agente_id.
    """
    if current.rol not in (
        RolUsuario.administrador.value,
        RolUsuario.mesa_ayuda.value,
    ):
        raise PermisoDenegado(
            "Solo administradores o mesa de ayuda pueden autoasignarse tickets"
        )
    ticket = await obtener(ticket_id, current, db)
    return await _asignar_a(ticket, agente=current, current=current, db=db)


async def cambiar_estado(
    ticket_id: UUID, data: EstadoUpdate, current: Usuario, db: AsyncSession
) -> Ticket:
    """Transiciona el estado validando la maquina de estados y permisos."""
    ticket = await obtener(ticket_id, current, db)
    nuevo = data.estado
    if not es_transicion_valida(ticket.estado, nuevo):
        raise Conflicto(f"Transicion invalida: {ticket.estado.value} -> {nuevo.value}")

    if nuevo == EstadoTicket.en_progreso:
        if current.rol == RolUsuario.cliente.value:
            raise PermisoDenegado("Solo agentes/admins pueden progresar un ticket")
        if ticket.agente_id is None:
            raise Conflicto("Ticket sin agente asignado")
        if current.rol == RolUsuario.agente.value and ticket.agente_id != current.id:
            raise PermisoDenegado("Solo el agente asignado puede progresar el ticket")

    elif nuevo == EstadoTicket.resuelto:
        if current.rol == RolUsuario.cliente.value:
            raise PermisoDenegado("Solo agentes/admins pueden resolver tickets")
        if ticket.agente_id is None:
            raise Conflicto("Ticket sin agente asignado")
        if current.rol == RolUsuario.agente.value and ticket.agente_id != current.id:
            raise PermisoDenegado("Solo el agente asignado puede resolver el ticket")

    elif nuevo == EstadoTicket.cerrado:
        if current.rol in (
            RolUsuario.administrador.value,
            RolUsuario.mesa_ayuda.value,
        ):
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
    if nuevo in (EstadoTicket.resuelto, EstadoTicket.cerrado) and ticket.fecha_resolucion is None:
        ticket.fecha_resolucion = func.now()
    await _registrar_historial(ticket.id, current.id, estado_anterior, nuevo, db)
    await db.commit()
    await db.refresh(ticket)
    empresa_nombre = (await db.execute(
        select(Empresa.nombre).where(Empresa.id == ticket.empresa_id)
    )).scalar_one_or_none()
    await _publicar_evento_ticket(ticket, "ticket:updated", empresa_nombre)
    await _publicar_cambio_estado(ticket, estado_anterior.value, empresa_nombre)
    if nuevo == EstadoTicket.resuelto:
        await _enviar_email_resolucion(ticket, db)
    from app.services import actividad_service
    await actividad_service.registrar(
        empresa_id=ticket.empresa_id,
        usuario_id=current.id,
        usuario_nombre=current.nombre,
        ticket_id=ticket.id,
        tipo_evento="state_changed",
        metadata={"estado_anterior": estado_anterior.value, "estado_nuevo": nuevo.value},
    )
    return ticket


async def _enviar_email_resolucion(ticket: Ticket, db: AsyncSession) -> None:
    """Lanza email de resolucion al cliente (fire-and-forget).

    Se dispara cuando el ticket pasa a `resuelto` (no en `cerrado`) porque
    el cliente tambien puede cerrar el ticket y ya habria recibido el aviso.
    """
    import asyncio

    from app.services import email_service

    cliente = (
        await db.execute(select(Usuario).where(Usuario.id == ticket.cliente_id))
    ).scalar_one_or_none()
    if cliente is None or not cliente.email:
        return
    if not cliente.notificaciones_email:
        return

    async def _run() -> None:
        try:
            await email_service.send_ticket_resolved(ticket, cliente.email)
        except Exception:
            _logger.exception("Error enviando email de resolucion para ticket %s", ticket.id)

    asyncio.create_task(_run())


async def cambiar_prioridad(
    ticket_id: UUID, data: PrioridadUpdate, current: Usuario, db: AsyncSession
) -> Ticket:
    ticket = await obtener(ticket_id, current, db)
    if es_estado_final(ticket.estado):
        raise Conflicto("Ticket cerrado, no se puede cambiar prioridad")
    if current.rol == RolUsuario.cliente.value and ticket.cliente_id != current.id:
        raise PermisoDenegado("Solo el autor puede cambiar prioridad")
    if current.rol == RolUsuario.agente.value and ticket.agente_id != current.id:
        raise PermisoDenegado("Solo el agente asignado puede cambiar la prioridad")
    prioridad_anterior = ticket.prioridad
    ticket.prioridad = data.prioridad
    ticket.modificado_por_id = current.id
    await db.commit()
    await db.refresh(ticket)
    empresa_nombre = (await db.execute(
        select(Empresa.nombre).where(Empresa.id == ticket.empresa_id)
    )).scalar_one_or_none()
    await _publicar_evento_ticket(ticket, "ticket:updated", empresa_nombre)
    from app.services import actividad_service
    await actividad_service.registrar(
        empresa_id=ticket.empresa_id,
        usuario_id=current.id,
        usuario_nombre=current.nombre,
        ticket_id=ticket.id,
        tipo_evento="priority_changed",
        metadata={"prioridad_anterior": prioridad_anterior.value, "prioridad_nueva": data.prioridad.value},
    )
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
    ticket.fecha_resolucion = None
    ticket.modificado_por_id = current.id
    await _registrar_historial(
        ticket.id, current.id, EstadoTicket.cerrado, EstadoTicket.abierto, db
    )
    await db.commit()
    await db.refresh(ticket)
    empresa_nombre = (await db.execute(
        select(Empresa.nombre).where(Empresa.id == ticket.empresa_id)
    )).scalar_one_or_none()
    await _publicar_evento_ticket(ticket, "ticket:updated", empresa_nombre)
    await _publicar_cambio_estado(ticket, EstadoTicket.cerrado, empresa_nombre)
    from app.services import actividad_service
    await actividad_service.registrar(
        empresa_id=ticket.empresa_id,
        usuario_id=current.id,
        usuario_nombre=current.nombre,
        ticket_id=ticket.id,
        tipo_evento="ticket_reopened",
        metadata={},
    )
    return ticket
