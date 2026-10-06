"""Schema del endpoint de estadisticas del dashboard."""

from __future__ import annotations

from pydantic import BaseModel


class StatsOut(BaseModel):
    total: int
    abiertos: int
    asignados: int
    en_progreso: int
    resueltos: int
    cerrados: int
    urgentes: int
    en_pausa: int = 0


class ItemEstado(BaseModel):
    estado: str
    cantidad: int


class ItemPrioridad(BaseModel):
    prioridad: str
    cantidad: int


class GraficasOut(BaseModel):
    cerrados_semana: int
    no_cerrados_por_estado: list[ItemEstado]
    no_cerrados_por_prioridad: list[ItemPrioridad]
