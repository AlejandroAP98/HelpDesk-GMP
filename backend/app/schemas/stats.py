"""Schema del endpoint de estadisticas del dashboard."""
from pydantic import BaseModel


class StatsOut(BaseModel):
    total: int
    abiertos: int
    asignados: int
    en_progreso: int
    resueltos: int
    cerrados: int
    urgentes: int
