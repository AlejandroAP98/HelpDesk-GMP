"""Endpoints CRUD de Subcategorías.

- GET (listar por categoría): cualquier usuario autenticado.
- POST/PATCH/DELETE: solo admin.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.usuario import Usuario
from app.schemas.categoria import SubcategoriaCreate, SubcategoriaOut, SubcategoriaUpdate
from app.schemas.usuario import Mensaje
from app.services import subcategoria_service
from app.utils.pagination import Pagina

router = APIRouter(prefix="/api/subcategorias", tags=["subcategorias"])


@router.get("/por-categoria/{categoria_id}", response_model=Pagina[SubcategoriaOut])
async def listar_por_categoria(
    categoria_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> Pagina[SubcategoriaOut]:
    pagina = await subcategoria_service.listar_por_categoria(
        categoria_id, page=page, size=size, db=db
    )
    return Pagina.of(
        [SubcategoriaOut.model_validate(s) for s in pagina.items],
        pagina.total, pagina.page, pagina.size,
    )


@router.get("/{subcategoria_id}", response_model=SubcategoriaOut)
async def obtener(
    subcategoria_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> SubcategoriaOut:
    sub = await subcategoria_service.obtener(subcategoria_id, db)
    return SubcategoriaOut.model_validate(sub)


@router.post("", response_model=SubcategoriaOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: SubcategoriaCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> SubcategoriaOut:
    sub = await subcategoria_service.crear(data, db)
    return SubcategoriaOut.model_validate(sub)


@router.patch("/{subcategoria_id}", response_model=SubcategoriaOut)
async def actualizar(
    subcategoria_id: int,
    data: SubcategoriaUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> SubcategoriaOut:
    sub = await subcategoria_service.actualizar(subcategoria_id, data, db)
    return SubcategoriaOut.model_validate(sub)


@router.delete("/{subcategoria_id}", response_model=Mensaje)
async def eliminar(
    subcategoria_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin),
) -> Mensaje:
    await subcategoria_service.eliminar(subcategoria_id, db)
    return Mensaje(detail=f"Subcategoría {subcategoria_id} eliminada")
