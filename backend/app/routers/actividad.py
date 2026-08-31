"""Router de actividad del dia (solo admin/mesa_ayuda)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_mesa_ayuda
from app.models.usuario import Usuario
from app.services import actividad_service

router = APIRouter(prefix="/api/actividad", tags=["actividad"])


@router.get("")
async def listar_actividad(
    limit: int = Query(default=20, ge=1, le=100),
    current: Usuario = Depends(require_mesa_ayuda),
) -> list[dict]:
    """Obtiene los ultimos eventos de actividad del dia.

    Solo accesible para admin y mesa_ayuda. Los datos son efimeros (24h, Redis).
    Admins/mesa con empresa_id=None ven actividad global (todas las empresas);
    con empresa_id seteada ven solo la actividad de su empresa.
    """
    return await actividad_service.obtener_ultimas(current.empresa_id, limit)
