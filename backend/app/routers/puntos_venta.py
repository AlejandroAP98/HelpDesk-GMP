"""Endpoints REST de Puntos de Venta."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.usuario import Usuario
from app.schemas.punto_venta import (
    PuntoVentaCreate,
    PuntoVentaOut,
    PuntoVentaUpdate,
)
from app.schemas.usuario import Mensaje
from app.services import punto_venta_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/puntos-venta", tags=["puntos-venta"])


def _to_out(pv, emp_nombre: str | None = None) -> PuntoVentaOut:
    return PuntoVentaOut(
        id=pv.id,
        empresa_id=pv.empresa_id,
        empresa_nombre=emp_nombre,
        nombre=pv.nombre,
        direccion=pv.direccion,
        ciudad=pv.ciudad,
        activo=pv.activo,
    )


@router.get("", response_model=Pagina[PuntoVentaOut])
async def listar(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    empresa_id: int | None = Query(None),
    q: str | None = Query(None, description="Buscar por nombre"),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> Pagina[PuntoVentaOut]:
    pagina = await punto_venta_service.listar(
        current=current, db=db, page=page, size=size, empresa_id=empresa_id, q=q
    )
    return Pagina.of(
        [_to_out(pv, emp_nombre) for pv, emp_nombre in pagina.items],
        pagina.total, pagina.page, pagina.size,
    )


@router.get("/por-empresa/{empresa_id}", response_model=list[PuntoVentaOut])
async def listar_por_empresa(
    empresa_id: int,
    solo_activos: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> list[PuntoVentaOut]:
    items = await punto_venta_service.listar_por_empresa(
        empresa_id, solo_activos, current, db
    )
    return [_to_out(pv) for pv in items]


@router.get("/{punto_venta_id}", response_model=PuntoVentaOut)
async def obtener(
    punto_venta_id: int,
    db: AsyncSession = Depends(get_db),
    current: Usuario = Depends(get_current_user),
) -> PuntoVentaOut:
    pv = await punto_venta_service.obtener(punto_venta_id, current, db)
    return _to_out(pv)


@router.post("", response_model=PuntoVentaOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: PuntoVentaCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> PuntoVentaOut:
    pv = await punto_venta_service.crear(data, db)
    return _to_out(pv)


@router.patch("/{punto_venta_id}", response_model=PuntoVentaOut)
async def actualizar(
    punto_venta_id: int,
    data: PuntoVentaUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> PuntoVentaOut:
    pv = await punto_venta_service.actualizar(punto_venta_id, data, db)
    return _to_out(pv)


@router.delete("/{punto_venta_id}", response_model=Mensaje)
async def eliminar(
    punto_venta_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> Mensaje:
    await punto_venta_service.eliminar(punto_venta_id, db)
    return Mensaje(detail=f"Punto de venta {punto_venta_id} eliminado")
