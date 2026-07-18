"""Servicio de cálculo de prioridad según la matriz de prioridades.

Lee la matriz desde la tabla `matriz_prioridad`. Si la tabla está vacía
(ej. en tests o recién migrado), construye la matriz por defecto desde
el diccionario hardcoded.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ElementoInfraestructura, PrioridadTicket
from app.models.matriz_prioridad import MatrizPrioridad


async def calcular_prioridad(
    categoria_id: int,
    subcategoria_id: int,
    elemento: ElementoInfraestructura,
    db: AsyncSession,
) -> PrioridadTicket:
    """Calcula la prioridad de un ticket según la matriz de prioridades.

    Consulta la tabla `matriz_prioridad` usando los IDs directamente.
    Si no existe la combinacion, retorna 'media' por defecto.
    """
    result = await db.execute(
        select(MatrizPrioridad.prioridad).where(
            MatrizPrioridad.categoria_id == categoria_id,
            MatrizPrioridad.subcategoria_id == subcategoria_id,
            MatrizPrioridad.elemento == elemento.value,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return PrioridadTicket.media
    try:
        return PrioridadTicket(row)
    except ValueError:
        return PrioridadTicket.media
