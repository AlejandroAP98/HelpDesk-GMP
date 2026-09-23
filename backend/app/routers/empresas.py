"""Endpoints CRUD de Empresas (solo admin)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin, require_mesa_ayuda
from app.models.usuario import Usuario
from app.schemas.empresa import EmpresaCreate, EmpresaOut, EmpresaUpdate
from app.schemas.usuario import Mensaje
from app.services import empresa_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/empresas", tags=["empresas"])


@router.get("", response_model=Pagina[EmpresaOut])
async def listar(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_mesa_ayuda),
) -> Pagina[EmpresaOut]:
    pagina = await empresa_service.listar(page=page, size=size, db=db)
    return Pagina.of(
        [EmpresaOut.model_validate(e) for e in pagina.items],
        pagina.total, pagina.page, pagina.size,
    )


@router.get("/{empresa_id}", response_model=EmpresaOut)
async def obtener(
    empresa_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_mesa_ayuda),
) -> EmpresaOut:
    empresa = await empresa_service.obtener(empresa_id, db)
    return EmpresaOut.model_validate(empresa)


@router.post("", response_model=EmpresaOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: EmpresaCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> EmpresaOut:
    empresa = await empresa_service.crear(data, db)
    return EmpresaOut.model_validate(empresa)


@router.patch("/{empresa_id}", response_model=EmpresaOut)
async def actualizar(
    empresa_id: int,
    data: EmpresaUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> EmpresaOut:
    empresa = await empresa_service.actualizar(empresa_id, data, db)
    return EmpresaOut.model_validate(empresa)


@router.delete("/{empresa_id}", response_model=Mensaje)
async def eliminar(
    empresa_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> Mensaje:
    await empresa_service.eliminar(empresa_id, db)
    return Mensaje(detail=f"Empresa {empresa_id} eliminada")