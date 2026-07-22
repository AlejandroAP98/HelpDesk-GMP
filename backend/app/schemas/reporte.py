"""Schemas para reportes y exportaciones."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.models.enums import EstadoTicket, PrioridadTicket


class ReporteFiltros(BaseModel):
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    empresa_id: int | None = None
    estado: EstadoTicket | None = None
    prioridad: PrioridadTicket | None = None
