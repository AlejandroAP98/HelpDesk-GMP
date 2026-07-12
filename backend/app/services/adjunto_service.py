"""Servicio de adjuntos: subir/listar/eliminar en MinIO + metadatos en DB."""
from __future__ import annotations

from io import BytesIO
from typing import BinaryIO
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import get_s3
from app.models.adjunto import Adjunto
from app.models.comentario import Comentario
from app.models.enums import RolUsuario
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.adjunto import AdjuntoOut
from app.services import ticket_service
from app.services.estados import es_estado_final
from app.utils.exceptions import Conflicto, PermisoDenegado, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion

MAX_BYTES = 10 * 1024 * 1024  # 10 MB


async def listar(
    ticket_id: UUID, current: Usuario, db: AsyncSession,
    page: int = 1, size: int = 20,
) -> Pagina[AdjuntoOut]:
    """Lista adjuntos de un ticket (con aislamiento multi-tenant por ticket_service.obtener)."""
    await ticket_service.obtener(ticket_id, current, db)
    p = paginacion(page, size)
    total = (
        await db.execute(
            select(func.count(Adjunto.id)).where(Adjunto.ticket_id == ticket_id)
        )
    ).scalar_one()
    items = (
        await db.execute(
            select(Adjunto)
            .where(Adjunto.ticket_id == ticket_id)
            .order_by(Adjunto.fecha_creacion.desc())
            .offset(p.offset)
            .limit(p.limit)
        )
    ).scalars().all()
    return Pagina.of(
        [AdjuntoOut.model_validate(a) for a in items],
        total, p.page, p.size,
    )


async def subir(
    ticket_id: UUID,
    file_name: str,
    content_type: str,
    data: bytes,
    current: Usuario,
    db: AsyncSession,
) -> AdjuntoOut:
    """Sube un archivo a MinIO y registra metadatos en `adjuntos`."""
    ticket = await ticket_service.obtener(ticket_id, current, db)
    if es_estado_final(ticket.estado):
        raise Conflicto("Ticket cerrado, no admite nuevos adjuntos")

    if len(data) > MAX_BYTES:
        raise Conflicto(f"Archivo excede {MAX_BYTES // (1024 * 1024)} MB")

    from uuid import uuid4
    object_key = f"tickets/{ticket_id}/{uuid4().hex}_{file_name}"

    s3 = get_s3()
    s3.upload_fileobj(
        Fileobj=BytesIO(data),
        Bucket=settings.minio_bucket,
        Key=object_key,
        ExtraArgs={"ContentType": content_type},
    )
    archivo_url = f"{settings.minio_endpoint}/{settings.minio_bucket}/{object_key}"

    adjunto = Adjunto(
        ticket_id=ticket_id,
        comentario_id=None,
        archivo_url=archivo_url,
        nombre_archivo=file_name,
        tipo_mime=content_type or None,
        tamano_bytes=len(data) or None,
    )
    db.add(adjunto)
    await db.commit()
    await db.refresh(adjunto)
    return AdjuntoOut.model_validate(adjunto)


async def eliminar(
    adjunto_id: UUID,
    current: Usuario,
    db: AsyncSession,
) -> None:
    """Elimina un adjunto de MinIO y de la DB. Cliente: solo su propio ticket."""
    adjunto = (
        await db.execute(select(Adjunto).where(Adjunto.id == adjunto_id))
    ).scalar_one_or_none()
    if adjunto is None:
        raise RecursoNoEncontrado("Adjunto no encontrado")

    ticket = await ticket_service.obtener(adjunto.ticket_id, current, db)
    if current.rol == RolUsuario.cliente.value and ticket.cliente_id != current.id:
        raise PermisoDenegado("No puedes borrar adjuntos de tickets ajenos")
    if current.rol == RolUsuario.agente.value and ticket.agente_id != current.id:
        raise PermisoDenegado("No puedes borrar adjuntos de tickets no asignados")

    object_key = adjunto.archivo_url.split(f"{settings.minio_bucket}/", 1)[-1]
    try:
        get_s3().delete_object(Bucket=settings.minio_bucket, Key=object_key)
    except Exception:
        pass
    await db.delete(adjunto)
    await db.commit()


async def attach_to_comentario(
    adjunto_id: UUID,
    comentario_id: UUID,
    current: Usuario,
    db: AsyncSession,
) -> AdjuntoOut:
    """Asocia un adjunto existente a un comentario."""
    adjunto = (
        await db.execute(select(Adjunto).where(Adjunto.id == adjunto_id))
    ).scalar_one_or_none()
    if adjunto is None:
        raise RecursoNoEncontrado("Adjunto no encontrado")
    comentario = (
        await db.execute(select(Comentario).where(Comentario.id == comentario_id))
    ).scalar_one_or_none()
    if comentario is None:
        raise RecursoNoEncontrado("Comentario no encontrado")
    if adjunto.ticket_id != comentario.ticket_id:
        raise Conflicto("Adjunto y comentario no pertenecen al mismo ticket")
    await ticket_service.obtener(adjunto.ticket_id, current, db)

    adjunto.comentario_id = comentario_id
    await db.commit()
    await db.refresh(adjunto)
    return AdjuntoOut.model_validate(adjunto)