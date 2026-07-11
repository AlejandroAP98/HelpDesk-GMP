"""Servicio de cálculo de prioridad según la matriz de prioridades."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categoria import Categoria
from app.models.enums import ElementoInfraestructura, PrioridadTicket
from app.models.subcategoria import Subcategoria


_MATRIZ: dict[tuple[str, str, ElementoInfraestructura], PrioridadTicket] = {}


def _r(cat: str, sub: str, elem: ElementoInfraestructura, pri: PrioridadTicket) -> None:
    _MATRIZ[(cat, sub, elem)] = pri


def _construir_matriz() -> None:
    if _MATRIZ:
        return

    E = ElementoInfraestructura
    P = PrioridadTicket

    # SOPORTE
    _r("Soporte", "Caída total del servicio", E.torre, P.urgente)
    _r("Soporte", "Caída total del servicio", E.celda, P.urgente)
    _r("Soporte", "Caída total del servicio", E.mastil, P.alta)
    _r("Soporte", "Caída total del servicio", E.punto_venta, P.alta)

    _r("Soporte", "Lentitud o intermitencia", E.torre, P.alta)
    _r("Soporte", "Lentitud o intermitencia", E.celda, P.alta)
    _r("Soporte", "Lentitud o intermitencia", E.mastil, P.media)
    _r("Soporte", "Lentitud o intermitencia", E.punto_venta, P.media)

    # INSTALACIÓN
    _r("Instalación", "Instalación o Cambio de Hardware", E.torre, P.media)
    _r("Instalación", "Instalación o Cambio de Hardware", E.mastil, P.media)
    _r("Instalación", "Instalación o Cambio de Hardware", E.punto_venta, P.baja)

    _r("Instalación", "Cableado estructurado", E.punto_venta, P.baja)

    _r("Instalación", "Configuración de equipos nuevos", E.torre, P.media)
    _r("Instalación", "Configuración de equipos nuevos", E.mastil, P.media)
    _r("Instalación", "Configuración de equipos nuevos", E.punto_venta, P.baja)

    # MANTENIMIENTO
    _r("Mantenimiento", "Actualización de Software", E.torre, P.media)
    _r("Mantenimiento", "Actualización de Software", E.celda, P.media)
    _r("Mantenimiento", "Actualización de Software", E.mastil, P.baja)
    _r("Mantenimiento", "Actualización de Software", E.punto_venta, P.baja)

    _r("Mantenimiento", "Limpieza y Respaldo", E.torre, P.baja)
    _r("Mantenimiento", "Limpieza y Respaldo", E.celda, P.baja)
    _r("Mantenimiento", "Limpieza y Respaldo", E.mastil, P.baja)
    _r("Mantenimiento", "Limpieza y Respaldo", E.punto_venta, P.baja)


async def calcular_prioridad(
    categoria_id: int,
    subcategoria_id: int,
    elemento: ElementoInfraestructura,
    db: AsyncSession,
) -> PrioridadTicket:
    """Calcula la prioridad de un ticket según la matriz de prioridades.

    Resuelve los nombres de categoría y subcategoría desde la DB y los cruza
    con el elemento de infraestructura. Si la combinación no está en la matriz,
    retorna 'media' por defecto.
    """
    _construir_matriz()

    cat = (await db.execute(
        select(Categoria.nombre).where(Categoria.id == categoria_id)
    )).scalar_one_or_none()
    sub = (await db.execute(
        select(Subcategoria.nombre).where(Subcategoria.id == subcategoria_id)
    )).scalar_one_or_none()

    if cat is None or sub is None:
        return PrioridadTicket.media

    return _MATRIZ.get((cat, sub, elemento), PrioridadTicket.media)
