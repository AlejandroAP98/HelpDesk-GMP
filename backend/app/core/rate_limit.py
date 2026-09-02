"""Rate limiting simple sobre Redis (ventana fija, fail-open).

Si Redis no esta disponible, se permite la peticion y se loguea warning:
la disponibilidad del login no depende del rate limiter.
"""
from __future__ import annotations

import logging

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


async def enforce_rate_limit(
    key: str,
    max_intentos: int,
    ventana_segundos: int,
    mensaje: str = "Demasiados intentos. Intentalo mas tarde.",
) -> None:
    """Incrementa el contador de `key` y lanza 429 si supera `max_intentos`.

    Ventana fija: el contador expira `ventana_segundos` despues del primer hit.
    Solo activo en prod (en dev/test no interfiere con flujos locales).
    Fail-open: si Redis falla, se permite la peticion.
    """
    if settings.app_env != "prod":
        return
    try:
        cnt = await redis_client.incr(key)
        if cnt == 1:
            await redis_client.expire(key, ventana_segundos)
        if cnt > max_intentos:
            ttl = await redis_client.ttl(key)
            retry = max(ttl, 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=mensaje,
                headers={"Retry-After": str(retry)},
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("Rate limiter no disponible (Redis caido?), fail-open", exc_info=True)
