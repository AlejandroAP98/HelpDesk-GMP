"""Servicio de comentarios: publicos y notas internas."""

from __future__ import annotations

from datetime import timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comentario import Comentario
from app.models.enums import RolUsuario
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.comentario import ComentarioCreate, ComentarioOut
from app.services import ticket_service
from app.services.estados import es_estado_final
from app.utils.exceptions import Conflicto, PermisoDenegado
from app.utils.pagination import Pagina, paginacion


async def _resolve_ticket(ticket_id: UUID, current: Usuario, db: AsyncSession) -> Ticket:
    return await ticket_service.obtener(ticket_id, current, db)


async def _resolve_implicated_user_ids(
    ticket: Ticket,
    current: Usuario,
    db: AsyncSession,
    *,
    es_nota_interna: bool,
) -> list[UUID]:
    """Usuarios que deben recibir la notificacion de un nuevo comentario.

    - Comentario publico: cliente del ticket + agente asignado.
    - Nota interna: agente asignado + admins de la empresa (cliente NUNCA la recibe).
    - El autor del comentario se excluye para no notificarse a si mismo.
    """
    implicated: set[UUID] = set()
    if not es_nota_interna and ticket.cliente_id is not None:
        implicated.add(ticket.cliente_id)
    if ticket.agente_id is not None:
        implicated.add(ticket.agente_id)
    if es_nota_interna:
        admin_rows = await db.execute(
            select(Usuario.id).where(
                Usuario.rol == RolUsuario.administrador.value,
                (Usuario.empresa_id == ticket.empresa_id)
                | (Usuario.empresa_id.is_(None)),
            )
        )
        for (uid,) in admin_rows.all():
            implicated.add(uid)
    implicated.discard(current.id)
    return list(implicated)


async def listar(
    ticket_id: UUID,
    current: Usuario,
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
) -> Pagina[ComentarioOut]:
    """Lista comentarios visibles: clientes solo ven publicos; agente/admin ven todos."""
    await _resolve_ticket(ticket_id, current, db)
    p = paginacion(page, size)

    base = (
        select(Comentario, Usuario.nombre.label("usuario_nombre"))
        .outerjoin(Usuario, Comentario.usuario_id == Usuario.id)
        .where(Comentario.ticket_id == ticket_id)
    )
    count_base = select(func.count(Comentario.id)).where(Comentario.ticket_id == ticket_id)

    if current.rol == RolUsuario.cliente.value:
        base = base.where(Comentario.es_nota_interna == False)  # noqa: E712
        count_base = count_base.where(Comentario.es_nota_interna == False)  # noqa: E712

    total = (await db.execute(count_base)).scalar_one()
    rows = (
        await db.execute(
            base.order_by(Comentario.fecha_creacion.asc()).offset(p.offset).limit(p.limit)
        )
    ).all()

    out: list[ComentarioOut] = []
    for c, usuario_nombre in rows:
        out.append(
            ComentarioOut.model_validate(
                {
                    **{k: getattr(c, k) for k in c.__table__.columns.keys()},
                    "usuario_nombre": usuario_nombre,
                }
            )
        )
    return Pagina.of(out, total, p.page, p.size)


async def crear(
    ticket_id: UUID,
    data: ComentarioCreate,
    current: Usuario,
    db: AsyncSession,
) -> ComentarioOut:
    """Crea comentario. Clientes no pueden emitir notas internas."""
    ticket = await _resolve_ticket(ticket_id, current, db)
    if es_estado_final(ticket.estado):
        raise Conflicto("Ticket cerrado, no admite nuevos comentarios")
    if data.es_nota_interna and current.rol == RolUsuario.cliente.value:
        raise PermisoDenegado("Solo agentes/admins pueden agregar notas internas")

    comentario = Comentario(
        ticket_id=ticket_id,
        usuario_id=current.id,
        contenido=data.contenido,
        es_nota_interna=data.es_nota_interna,
    )
    db.add(comentario)

    marco_frt = False
    if current.rol != RolUsuario.cliente.value and ticket.fecha_primera_respuesta is None:
        ticket.fecha_primera_respuesta = func.now()
        marco_frt = True

    await db.commit()
    await db.refresh(comentario)
    if marco_frt:
        await db.refresh(ticket)

    try:
        from app.websockets.pubsub import publish_to_users

        event = {
            "type": "ticket:commented",
            "ticket_id": str(ticket_id),
            "comentario_id": str(comentario.id),
            "usuario_id": str(current.id),
            "usuario_nombre": current.nombre,
            "contenido": data.contenido,
            "es_nota_interna": data.es_nota_interna,
            "fecha_creacion": comentario.fecha_creacion.replace(tzinfo=timezone.utc).isoformat(),
        }
        implicated = await _resolve_implicated_user_ids(
            ticket, current, db, es_nota_interna=data.es_nota_interna
        )
        if implicated:
            await publish_to_users(implicated, event=event)
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "No se pudo publicar ticket:commented para ticket %s", ticket_id, exc_info=True
        )

    from app.services import actividad_service
    await actividad_service.registrar(
        empresa_id=ticket.empresa_id,
        usuario_id=current.id,
        usuario_nombre=current.nombre,
        ticket_id=ticket_id,
        tipo_evento="comment_added",
        metadata={"es_nota_interna": data.es_nota_interna},
    )

    return ComentarioOut.model_validate(
        {
            **{k: getattr(comentario, k) for k in comentario.__table__.columns.keys()},
            "usuario_nombre": current.nombre,
        }
    )
