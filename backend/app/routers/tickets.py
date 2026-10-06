"""Endpoints REST de Tickets."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_mesa_ayuda
from app.models.enums import EstadoTicket, PrioridadTicket, VistaTicket
from app.models.ticket import Ticket
from app.models.usuario import Usuario
from app.schemas.ticket import (
    AsignacionRequest,
    EstadoUpdate,
    HistorialEstadoOut,
    PausaRequest,
    PrioridadUpdate,
    TicketAdminCreate,
    TicketCreate,
    TicketDetalle,
    TicketOut,
    TicketUpdate,
)
from app.models.empresa import Empresa
from app.services import ticket_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


async def _ticket_to_out(ticket: Ticket, db: AsyncSession) -> TicketOut:
    emp = (
        await db.execute(select(Empresa.nombre).where(Empresa.id == ticket.empresa_id))
    ).scalar_one_or_none()
    cli = (
        await db.execute(select(Usuario.nombre).where(Usuario.id == ticket.cliente_id))
    ).scalar_one_or_none()
    out = TicketOut.model_validate(ticket)
    out.empresa_nombre = emp
    out.cliente_nombre = cli
    return out


@router.get("", response_model=Pagina[TicketOut])
async def listar(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    estado: EstadoTicket | None = Query(None),
    prioridad: PrioridadTicket | None = Query(None),
    empresa_id: int | None = Query(None),
    agente_id: UUID | None = Query(None),
    cliente_id: UUID | None = Query(None),
    vista: VistaTicket | None = Query(None),
    fecha_inicio: date | None = Query(
        None, description="Filtrar tickets creados desde esta fecha (YYYY-MM-DD)"
    ),
    fecha_fin: date | None = Query(
        None, description="Filtrar tickets creados hasta esta fecha (YYYY-MM-DD)"
    ),
    orden: str | None = Query(None, description="Ordenamiento: 'prioridad' (default) o 'fecha'"),
    q: str | None = Query(None, description="Buscar por #ticket o titulo"),
    punto_venta_id: int | None = Query(None, description="Filtrar por punto de venta (FK)"),
    en_pausa: bool | None = Query(None, description="Filtrar por tickets en pausa"),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> Pagina[TicketOut]:
    pagina = await ticket_service.listar(
        current=current,
        db=db,
        page=page,
        size=size,
        estado=estado,
        prioridad=prioridad,
        empresa_id=empresa_id,
        agente_id=agente_id,
        cliente_id=cliente_id,
        vista=vista,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        orden=orden,
        q=q,
        punto_venta_id=punto_venta_id,
        en_pausa=en_pausa,
    )
    return Pagina.of(
        [
            TicketOut(
                id=t.id,
                empresa_id=t.empresa_id,
                empresa_nombre=emp_nombre,
                cliente_id=t.cliente_id,
                cliente_nombre=cliente_nombre,
                agente_id=t.agente_id,
                agente_nombre=agente_nombre,
                modificado_por_id=t.modificado_por_id,
                categoria_id=t.categoria_id,
                subcategoria_id=t.subcategoria_id,
                elemento_afectado=t.elemento_afectado,
                titulo=t.titulo,
                descripcion=t.descripcion,
                ip_pcs=t.ip_pcs,
                ip_antena=t.ip_antena,
                mascara_red=t.mascara_red,
                puerta_enlace=t.puerta_enlace,
                nombre_punto=t.nombre_punto,
                estado=t.estado,
                prioridad=t.prioridad,
                fecha_creacion=t.fecha_creacion,
                fecha_actualizacion=t.fecha_actualizacion,
                fecha_asignacion=t.fecha_asignacion,
                fecha_primera_respuesta=t.fecha_primera_respuesta,
                fecha_resolucion=t.fecha_resolucion,
                en_pausa=t.en_pausa,
                motivo_pausa=t.motivo_pausa,
                fecha_pausa=t.fecha_pausa,
                segundos_pausa_acumulado=t.segundos_pausa_acumulado,
            )
            for t, emp_nombre, agente_nombre, cliente_nombre in pagina.items
        ],
        pagina.total,
        pagina.page,
        pagina.size,
    )


@router.get("/{ticket_id}", response_model=TicketDetalle)
async def obtener(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketDetalle:
    return await ticket_service.obtener_detalle(ticket_id, current, db)


@router.get("/{ticket_id}/historial", response_model=Pagina[HistorialEstadoOut])
async def historial(
    ticket_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> Pagina[HistorialEstadoOut]:
    return await ticket_service.listar_historial(ticket_id, current, db, page=page, size=size)


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.crear(data, current, db)
    return await _ticket_to_out(ticket, db)


@router.post("/admin", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def crear_admin(
    data: TicketAdminCreate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> TicketOut:
    """Admin/mesa_ayuda crea un ticket a nombre de un cliente de una empresa
    (reporte telefonico/WhatsApp o trabajo interno de la empresa propia)."""
    ticket = await ticket_service.crear_admin(data, current, db)
    return await _ticket_to_out(ticket, db)


@router.patch("/{ticket_id}", response_model=TicketOut)
async def actualizar(
    ticket_id: UUID,
    data: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.actualizar(ticket_id, data, current, db)
    return await _ticket_to_out(ticket, db)


@router.post("/{ticket_id}/asignar", response_model=TicketOut)
async def asignar(
    ticket_id: UUID,
    data: AsignacionRequest,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> TicketOut:
    ticket = await ticket_service.asignar(ticket_id, data, current, db)
    return await _ticket_to_out(ticket, db)


@router.post("/{ticket_id}/asignarme", response_model=TicketOut)
async def asignarme(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> TicketOut:
    """Admin o mesa de ayuda se autoasigna un ticket abierto."""
    ticket = await ticket_service.asignarme(ticket_id, current, db)
    return await _ticket_to_out(ticket, db)


@router.patch("/{ticket_id}/estado", response_model=TicketOut)
async def cambiar_estado(
    ticket_id: UUID,
    data: EstadoUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.cambiar_estado(ticket_id, data, current, db)
    return await _ticket_to_out(ticket, db)


@router.patch("/{ticket_id}/prioridad", response_model=TicketOut)
async def cambiar_prioridad(
    ticket_id: UUID,
    data: PrioridadUpdate,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.cambiar_prioridad(ticket_id, data, current, db)
    return await _ticket_to_out(ticket, db)


@router.post("/{ticket_id}/cerrar", response_model=TicketOut)
async def cerrar(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> TicketOut:
    ticket = await ticket_service.cambiar_estado(
        ticket_id, EstadoUpdate(estado=EstadoTicket.cerrado), current, db
    )
    return await _ticket_to_out(ticket, db)


@router.post("/{ticket_id}/reabrir", response_model=TicketOut)
async def reabrir(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_admin),
) -> TicketOut:
    ticket = await ticket_service.reabrir(ticket_id, current, db)
    return await _ticket_to_out(ticket, db)


@router.post("/{ticket_id}/pausar", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def pausar(
    ticket_id: UUID,
    data: PausaRequest,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> TicketOut:
    """Pausa un ticket que espera algo externo al equipo (permiso del cliente,
    repuesto, aprobacion gerencial). Permisos: admin o mesa de ayuda. Solo
    valido en estados asignado/en_progreso."""
    ticket = await ticket_service.poner_en_pausa(ticket_id, data, current, db)
    return await _ticket_to_out(ticket, db)


@router.post("/{ticket_id}/reanudar", response_model=TicketOut)
async def reanudar(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(require_mesa_ayuda),
) -> TicketOut:
    """Reanuda un ticket pausado. Acumula el tiempo transcurrido en
    segundos_pausa_acumulado para descontarlo del MTTR/SLA. Permisos:
    admin o mesa de ayuda."""
    ticket = await ticket_service.reanudar(ticket_id, current, db)
    return await _ticket_to_out(ticket, db)
