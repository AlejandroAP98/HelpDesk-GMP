"""Servicio de comentarios: publicos y notas internas."""

from __future__ import annotations

from collections import defaultdict
from datetime import timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.adjunto import Adjunto
from app.models.comentario import Comentario
from app.models.enums import RolUsuario
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.comentario import ComentarioCreate, ComentarioOut
from app.services import adjunto_service, ticket_service
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

    - Comentario publico: cliente del ticket + agente asignado + admins
      de la empresa (o admins globales).
    - Nota interna: agente asignado + admins (cliente NUNCA la recibe).
    - El autor del comentario se excluye para no notificarse a si mismo.
    """
    implicated: set[UUID] = set()
    if not es_nota_interna and ticket.cliente_id is not None:
        implicated.add(ticket.cliente_id)
    if ticket.agente_id is not None:
        implicated.add(ticket.agente_id)
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


def _comentario_to_out(
    comentario: Comentario, usuario_nombre: str | None, adjuntos: list[Adjunto]
) -> ComentarioOut:
    return ComentarioOut.model_validate(
        {
            **{k: getattr(comentario, k) for k in comentario.__table__.columns.keys()},
            "usuario_nombre": usuario_nombre,
            "adjuntos": [adjunto_service.to_out(a) for a in adjuntos],
        }
    )


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

    comentario_ids = [c.id for c, _ in rows]
    adjuntos_por_comentario: dict[UUID, list[Adjunto]] = defaultdict(list)
    if comentario_ids:
        adjuntos_rows = await db.execute(
            select(Adjunto)
            .where(Adjunto.comentario_id.in_(comentario_ids))
            .order_by(Adjunto.fecha_creacion.asc())
        )
        for adjunto in adjuntos_rows.scalars().all():
            if adjunto.comentario_id is not None:
                adjuntos_por_comentario[adjunto.comentario_id].append(adjunto)

    out: list[ComentarioOut] = []
    for c, usuario_nombre in rows:
        out.append(
            _comentario_to_out(
                c, usuario_nombre, adjuntos_por_comentario.get(c.id, [])
            )
        )
    return Pagina.of(out, total, p.page, p.size)


async def crear(
    ticket_id: UUID,
    data: ComentarioCreate,
    current: Usuario,
    db: AsyncSession,
    files: list[tuple[str, str, bytes]] | None = None,
) -> ComentarioOut:
    """Crea comentario. Clientes no pueden emitir notas internas.
    `files` es una lista de (file_name, content_type, data)."""
    files = files or []
    ticket = await _resolve_ticket(ticket_id, current, db)
    if es_estado_final(ticket.estado):
        raise Conflicto("Ticket cerrado, no admite nuevos comentarios")
    if data.es_nota_interna and current.rol == RolUsuario.cliente.value:
        raise PermisoDenegado("Solo agentes/admins pueden agregar notas internas")
    contenido = data.contenido.strip() if data.contenido else None
    if not contenido and not files:
        raise Conflicto("El comentario debe tener texto o al menos una imagen")

    total_adjuntos = await adjunto_service._contar_adjuntos_ticket(ticket_id, db)
    if total_adjuntos + len(files) > adjunto_service.MAX_ADJUNTOS_POR_TICKET:
        raise Conflicto(
            f"El ticket alcanzaría el límite de {adjunto_service.MAX_ADJUNTOS_POR_TICKET} adjuntos"
        )

    comentario = Comentario(
        ticket_id=ticket_id,
        usuario_id=current.id,
        contenido=contenido,
        es_nota_interna=data.es_nota_interna,
    )
    db.add(comentario)

    marco_frt = False
    if current.rol != RolUsuario.cliente.value and ticket.fecha_primera_respuesta is None:
        ticket.fecha_primera_respuesta = func.now()
        marco_frt = True

    await db.flush()

    adjuntos: list[Adjunto] = []
    for file_name, content_type, file_data in files:
        object_key, _, normalized_mime = await adjunto_service.subir_a_storage(
            ticket_id, file_name, content_type, file_data
        )
        adjunto = Adjunto(
            ticket_id=ticket_id,
            comentario_id=comentario.id,
            archivo_url=f"{settings.minio_bucket}/{object_key}",
            nombre_archivo=file_name,
            tipo_mime=normalized_mime,
            tamano_bytes=len(file_data) or None,
        )
        db.add(adjunto)
        adjuntos.append(adjunto)

    await db.commit()
    await db.refresh(comentario)
    if marco_frt:
        await db.refresh(ticket)
    for a in adjuntos:
        await db.refresh(a)

    try:
        from app.websockets.pubsub import publish_to_users

        event = {
            "type": "ticket:commented",
            "ticket_id": str(ticket_id),
            "comentario_id": str(comentario.id),
            "usuario_id": str(current.id),
            "usuario_nombre": current.nombre,
            "contenido": contenido,
            "es_nota_interna": data.es_nota_interna,
            "fecha_creacion": comentario.fecha_creacion.replace(tzinfo=timezone.utc).isoformat(),
            "adjuntos": [adjunto_service.to_out(a).model_dump(mode="json") for a in adjuntos],
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
        metadata={"es_nota_interna": data.es_nota_interna, "adjuntos": len(files)},
    )

    return _comentario_to_out(comentario, current.nombre, adjuntos)
