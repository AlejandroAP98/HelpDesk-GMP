"""Scheduler HelpDesk-GMP - cierre automatico de tickets resueltos + recordatorios de eventos.

Conecta a Postgres via SQLAlchemy async, actualiza `tickets` a `cerrado` cuando
estan en estado `resuelto` y su `fecha_actualizacion` supera `TICKET_AUTO_CLOSE_DAYS`.
Tambien envia recordatorios por email de eventos programados.

Como el microservicio es desechable y aislado, usa SQL directo (text) en lugar de
importar el ORM del backend (evita acoplamiento + problemas de path en WSL2).
"""
from __future__ import annotations

import asyncio
import html
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

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


async def enviar_recordatorios_eventos() -> int:
    """Envia emails de recordatorio para eventos programados.

    Cada evento tiene su propio campo `minutos_antes` que define cuántos minutos
    antes del evento se debe enviar el recordatorio. La ventana de busqueda es de
    10 minutos hacia atras: tolera caidas cortas del scheduler enviando el email
    tarde, sin perder recordatorios, y sin duplicados (email_enviado se marca).

    Returns:
        Numero de recordatorios enviados.
    """
    resend_api_key = os.getenv("RESEND_API_KEY", "")
    resend_from_email = os.getenv("RESEND_FROM_EMAIL", "noreply@helpdesk.local")

    if not resend_api_key:
        logger.debug("Recordatorios omitidos: RESEND_API_KEY vacio")
        return 0

    logger.info("Buscando eventos para recordatorio")

    engine = _build_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with Session() as db:
            ahora = datetime.now(timezone.utc)
            ventana_inicio = ahora - timedelta(minutes=10)
            stmt = text(
                """
                SELECT e.id, e.titulo, e.descripcion, e.fecha_inicio, e.ticket_id, u.email
                FROM eventos_calendario e
                JOIN usuarios u ON e.usuario_id = u.id
                WHERE e.recordar_email = true
                  AND e.email_enviado = false
                  AND e.fecha_inicio > :ahora
                  AND (e.fecha_inicio - (e.minutos_antes * interval '1 minute')) >= :ventana_inicio
                  AND (e.fecha_inicio - (e.minutos_antes * interval '1 minute')) <= :ahora
                """
            )

            result = await db.execute(stmt, {"ahora": ahora, "ventana_inicio": ventana_inicio})
            eventos = result.fetchall()

            enviados = 0
            for evento in eventos:
                evento_id, titulo, descripcion, fecha_inicio, ticket_id, email = evento
                if not email:
                    continue

                titulo_esc = html.escape(titulo or "")
                descripcion_esc = html.escape(descripcion) if descripcion else None
                fecha_str = fecha_inicio.strftime("%d/%m/%Y %H:%M")

                html_mail = f"""
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #007991; margin-top: 0; font-size: 24px; font-weight: 700;">Recordatorio de evento</h2>
                    <p style="color: #374151; font-size: 14px; line-height: 1.5;">Tienes un evento programado para hoy.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                        <tr><td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Evento:</td><td style="padding: 10px 0; text-align: right;"><strong style="color: #111827;">{titulo_esc}</strong></td></tr>
                        <tr><td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Fecha y hora:</td><td style="padding: 10px 0; text-align: right;">{fecha_str}</td></tr>
                    </table>
                    {f'<p style="color: #374151; font-size: 14px;">{descripcion_esc}</p>' if descripcion_esc else ''}
                </div>
                """

                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        r = await client.post(
                            "https://api.resend.com/emails",
                            json={
                                "from": resend_from_email,
                                "to": [email],
                                "subject": f"[Soporte GMP] Recordatorio: {titulo}",
                                "html": html_mail,
                            },
                            headers={
                                "Authorization": f"Bearer {resend_api_key}",
                                "Content-Type": "application/json",
                            },
                        )
                        if r.status_code < 400:
                            await db.execute(
                                text("UPDATE eventos_calendario SET email_enviado = true WHERE id = :id"),
                                {"id": evento_id}
                            )
                            await db.commit()
                            enviados += 1
                            logger.info("Recordatorio enviado a %s para evento %s", email, titulo)
                        else:
                            logger.warning("Resend rechazo email a %s: %s", email, r.status_code)
                except Exception as exc:
                    logger.warning("Error enviando recordatorio a %s: %s", email, exc)

            logger.info("Recordatorios enviados: %d/%d", enviados, len(eventos))
            return enviados
    except Exception:
        logger.exception("Error enviando recordatorios de eventos")
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
    scheduler.add_job(
        enviar_recordatorios_eventos,
        IntervalTrigger(minutes=1),
        id="enviar_recordatorios_eventos",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler iniciado. Cron '%s' - cierra tickets resueltos > %s dias",
        cron_expr,
        os.getenv("TICKET_AUTO_CLOSE_DAYS", "7"),
    )
    logger.info("Recordatorios de eventos: cada 1 minuto")
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        scheduler.shutdown(wait=False)
        logger.info("Scheduler detenido")


if __name__ == "__main__":
    asyncio.run(main())