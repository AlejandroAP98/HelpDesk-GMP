"""Scheduler HelpDesk-GMP - cierre automatico de tickets resueltos.

Conecta a Postgres via SQLAlchemy async, actualiza `tickets` a `cerrado` cuando
estan en estado `resuelto` y su `fecha_actualizacion` supera `TICKET_AUTO_CLOSE_DAYS`.

Como el microservicio es desechable y aislado, usa SQL directo (text) en lugar de
importar el ORM del backend (evita acoplamiento + problemas de path en WSL2).
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("scheduler")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://helpdesk:helpdesk@postgres:5432/helpdesk",
)


def _build_engine():
    return create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5)


async def cerrar_tickets_resueltos() -> int:
    """Cierra tickets en estado 'resuelto' con mas de N dias de inactividad.

    Returns:
        Numero de tickets cerrados.
    """
    dias = int(os.getenv("TICKET_AUTO_CLOSE_DAYS", "7"))
    logger.info("Buscando tickets en estado resuelto hace > %s dias", dias)

    engine = _build_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with Session() as db:
            stmt = text(
                """
                UPDATE tickets
                SET estado = 'cerrado',
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE estado = 'resuelto'
                  AND fecha_actualizacion < CURRENT_TIMESTAMP - make_interval(days => :dias)
                """
            ).bindparams(dias=dias)
            result = await db.execute(stmt)
            await db.commit()
            cerrados = result.rowcount or 0
            logger.info("Cierre automatico: %s ticket(s) cerrados", cerrados)
            return cerrados
    except Exception:
        logger.exception("Error cerrando tickets resueltos")
        return 0
    finally:
        await engine.dispose()


def parse_cron(expr: str) -> dict:
    """Convierte '0 2 * * *' en kwargs para CronTrigger."""
    parts = expr.split()
    if len(parts) != 5:
        raise ValueError(f"Cron invalido (esperado 5 campos): {expr!r}")
    m, h, dom, mon, dow = parts
    return dict(minute=m, hour=h, day=dom, month=mon, day_of_week=dow)


async def main() -> None:
    scheduler = AsyncIOScheduler()
    cron_expr = os.getenv("SCHEDULER_CLOSE_TICKETS_CRON", "0 2 * * *")
    scheduler.add_job(
        cerrar_tickets_resueltos,
        CronTrigger(**parse_cron(cron_expr)),
        id="cerrar_tickets_resueltos",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler iniciado. Cron '%s' - cierra tickets resueltos > %s dias",
        cron_expr,
        os.getenv("TICKET_AUTO_CLOSE_DAYS", "7"),
    )
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        scheduler.shutdown(wait=False)
        logger.info("Scheduler detenido")


if __name__ == "__main__":
    asyncio.run(main())