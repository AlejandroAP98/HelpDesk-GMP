"""Utilidades compartidas de schemas Pydantic."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def _ensure_utc_iso(dt: datetime) -> str:
    """Convierte naive datetime (almacenado como UTC) a ISO 8601 con sufijo Z."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


DatetimeUTC = Annotated[datetime, PlainSerializer(_ensure_utc_iso, return_type=str)]
