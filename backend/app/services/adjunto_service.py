"""Servicio de adjuntos: subir/listar/eliminar en MinIO + metadatos en DB."""
from __future__ import annotations

from io import BytesIO
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import s3_delete_object, s3_get_object, s3_upload_fileobj
from app.models.adjunto import Adjunto
from app.models.comentario import Comentario
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.schemas.adjunto import AdjuntoOut
from app.services import ticket_service
from app.services.estados import es_estado_final
from app.utils.exceptions import Conflicto, PermisoDenegado, RecursoNoEncontrado
from app.utils.pagination import Pagina, paginacion

MAX_BYTES = 10 * 1024 * 1024
ALLOWED_MIME_TYPES: frozenset[str] = frozenset({"image/jpeg", "image/png", "image/webp"})
ALLOWED_EXTENSIONS: frozenset[str] = frozenset({".jpg", ".jpeg", ".png", ".webp"})

JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
WEBP_MAGIC_RIFF = b"RIFF"
WEBP_MAGIC_WEBP = b"WEBP"

MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _validate_magic_bytes(data: bytes, declared_mime: str) -> None:
    """Verifica que los magic bytes del archivo coincidan con el MIME declarado.
    Defensa contra clientes que envian un Content-Type falso."""
    if declared_mime == "image/jpeg":
        if not data.startswith(JPEG_MAGIC):
            raise Conflicto("El archivo no es un JPEG valido")
    elif declared_mime == "image/png":
        if not data.startswith(PNG_MAGIC):
            raise Conflicto("El archivo no es un PNG valido")
    elif declared_mime == "image/webp":
        if not (data.startswith(WEBP_MAGIC_RIFF) and data[8:12] == WEBP_MAGIC_WEBP):
            raise Conflicto("El archivo no es un WebP valido")


def _to_out(adjunto: Adjunto) -> AdjuntoOut:
    """Serializa un Adjunto con `archivo_url` apuntando al endpoint proxy del backend.
    Es una ruta relativa, asi el navegador la resuelve contra el host actual
    (LAN https://helpdesk.local o Cloudflare https://soporte.gmpredes.online)."""
    data = AdjuntoOut.model_validate(adjunto).model_dump()
    data["archivo_url"] = (
        f"/api/tickets/{adjunto.ticket_id}/adjuntos/{adjunto.id}/archivo"
    )
    return AdjuntoOut.model_validate(data)


def get_object_key(adjunto: Adjunto) -> str:
    """Extrae el object_key (path dentro del bucket) desde `archivo_url` guardado."""
    return adjunto.archivo_url.split(f"{settings.minio_bucket}/", 1)[-1]


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
        [_to_out(a) for a in items],
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
    """Sube una imagen a MinIO y registra metadatos en `adjuntos`.
    Solo acepta JPEG, PNG y WebP."""
    ticket = await ticket_service.obtener(ticket_id, current, db)
    if es_estado_final(ticket.estado):
        raise Conflicto("Ticket cerrado, no admite nuevos adjuntos")

    if len(data) > MAX_BYTES:
        raise Conflicto(f"Archivo excede {MAX_BYTES // (1024 * 1024)} MB")

    normalized_mime = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized_mime not in ALLOWED_MIME_TYPES:
        raise Conflicto(
            f"Tipo de archivo no permitido. Solo se aceptan imagenes "
            f"(JPEG, PNG, WebP). Recibido: {normalized_mime or 'desconocido'}"
        )

    ext = "." + file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise Conflicto(
            f"Extension de archivo no permitida. Solo se aceptan "
            f"{', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    _validate_magic_bytes(data, normalized_mime)

    object_key = f"tickets/{ticket_id}/{uuid4().hex}{MIME_TO_EXT[normalized_mime]}"

    await s3_upload_fileobj(
        Fileobj=BytesIO(data),
        Bucket=settings.minio_bucket,
        Key=object_key,
        ExtraArgs={"ContentType": normalized_mime},
    )

    adjunto = Adjunto(
        ticket_id=ticket_id,
        comentario_id=None,
        archivo_url=f"{settings.minio_bucket}/{object_key}",
        nombre_archivo=file_name,
        tipo_mime=normalized_mime,
        tamano_bytes=len(data) or None,
    )
    db.add(adjunto)
    await db.commit()
    await db.refresh(adjunto)
    return _to_out(adjunto)


async def eliminar(
    ticket_id: UUID,
    adjunto_id: UUID,
    current: Usuario,
    db: AsyncSession,
) -> None:
    """Elimina un adjunto de MinIO y de la DB. Cliente: solo su propio ticket."""
    adjunto = (
        await db.execute(select(Adjunto).where(Adjunto.id == adjunto_id))
    ).scalar_one_or_none()
    if adjunto is None or adjunto.ticket_id != ticket_id:
        raise RecursoNoEncontrado("Adjunto no encontrado")

    ticket = await ticket_service.obtener(ticket_id, current, db)
    if current.rol == RolUsuario.cliente.value and ticket.cliente_id != current.id:
        raise PermisoDenegado("No puedes borrar adjuntos de tickets ajenos")
    if current.rol == RolUsuario.agente.value and ticket.agente_id != current.id:
        raise PermisoDenegado("No puedes borrar adjuntos de tickets no asignados")

    object_key = get_object_key(adjunto)
    try:
        await s3_delete_object(Bucket=settings.minio_bucket, Key=object_key)
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
    return _to_out(adjunto)


async def stream_archivo(
    ticket_id: UUID,
    adjunto_id: UUID,
    current: Usuario,
    db: AsyncSession,
    range_header: str | None = None,
) -> dict:
    """Obtiene el archivo de MinIO para streaming al cliente.
    Valida acceso multi-tenant via `ticket_service.obtener`.
    Si se pasa `range_header`, respeta el pedido de bytes parciales.
    Retorna un dict con `body`, `content_type`, `content_length`, `content_range`, `status_code`."""
    await ticket_service.obtener(ticket_id, current, db)
    adjunto = (
        await db.execute(select(Adjunto).where(Adjunto.id == adjunto_id))
    ).scalar_one_or_none()
    if adjunto is None or adjunto.ticket_id != ticket_id:
        raise RecursoNoEncontrado("Adjunto no encontrado")

    object_key = get_object_key(adjunto)
    get_params: dict = {"Bucket": settings.minio_bucket, "Key": object_key}
    if range_header:
        get_params["Range"] = range_header

    try:
        obj = await s3_get_object(**get_params)
    except Exception as e:
        if "NoSuchKey" in type(e).__name__ or "404" in str(e):
            raise RecursoNoEncontrado("Archivo no encontrado en storage")
        raise

    return {
        "body": obj["Body"],
        "content_type": adjunto.tipo_mime or "application/octet-stream",
        "content_length": obj.get("ContentLength"),
        "content_range": obj.get("ContentRange"),
        "status_code": 206 if range_header else 200,
        "nombre_archivo": adjunto.nombre_archivo or str(adjunto_id),
    }
