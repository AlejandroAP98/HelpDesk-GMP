"""Helpers de horario laboral para calculo de SLA.

Regla unica del HelpDesk-GMP:
- Si el ticket se crea DENTRO del horario laboral (hora_inicio <= h < hora_fin),
  el reloj de SLA arranca de inmediato y corre de forma continua durante
  todo el ciclo de vida del ticket (asignacion, primera respuesta, resolucion).
- Si se crea FUERA del horario laboral (h < hora_inicio o h >= hora_fin),
  el reloj arranca al proximo hora_inicio:00 del dia siguiente y desde ahi
  corre de forma continua, sin volver a pausarse por noches ni fines de
  semana (MVP).

La franja se evalua contra la zona horaria del negocio
(`settings.app_timezone`, default `America/Bogota`), no contra la hora
UTC del servidor. Esto es lo que hace coherente el calculo cuando la DB
guarda timestamps naive en UTC y los clientes estan en otra zona.

Esto refleja los acuerdos con las empresas: las horas en que no hay quien
atienda no cuentan al inicio, pero una vez que el ticket "nace vivo" en
horario, la responsabilidad operativa se mide en reloj de pared continuo.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings


_NEGOCIO_TZ = ZoneInfo(settings.app_timezone)


def tiempo_sla_transcurrido(
    inicio: datetime,
    fin: datetime,
    hora_inicio: int | None = None,
    hora_fin: int | None = None,
) -> timedelta:
    """Devuelve el tiempo de SLA transcurrido entre `inicio` y `fin`.

    Args:
        inicio: timestamp de creacion del ticket (o del evento anterior).
            Se interpreta como hora UTC si es naive, o se convierte si
            trae tzinfo.
        fin: timestamp de primera respuesta / resolucion (o "ahora").
            Mismo tratamiento que `inicio`.
        hora_inicio: hora (0-23) de inicio de la jornada laboral. Si es
            None, usa `settings.sla_hora_inicio_laboral`.
        hora_fin: hora (1-24) de fin de la jornada laboral. Si es None,
            usa `settings.sla_hora_fin_laboral`. Debe ser mayor que
            `hora_inicio`; no se soportan franjas invertidas o nulas.

    Returns:
        `timedelta(0)` si `fin <= arranque_real` (respuesta antes del
        arranque del reloj). En caso contrario, `fin - arranque_real`.
    """
    h_inicio = settings.sla_hora_inicio_laboral if hora_inicio is None else hora_inicio
    h_fin = settings.sla_hora_fin_laboral if hora_fin is None else hora_fin

    inicio_utc = _a_utc(inicio)
    fin_utc = _a_utc(fin)
    if fin_utc <= inicio_utc:
        return timedelta(0)

    arranque = _inicio_reloj_sla_utc(inicio_utc, h_inicio, h_fin)
    delta = fin_utc - arranque
    return max(delta, timedelta(0))


def tiempo_pausa_sla_transcurrido(
    fecha_creacion: datetime,
    inicio_pausa: datetime,
    fin_pausa: datetime,
    hora_inicio: int | None = None,
    hora_fin: int | None = None,
) -> timedelta:
    """Devuelve solo la parte de una pausa que se superpone al reloj SLA.

    Si el ticket nació fuera de jornada, la pausa anterior al arranque efectivo
    del SLA no se descuenta. Las pausas posteriores al arranque se descuentan
    completas, de acuerdo con la regla de reloj continuo del ticket.
    """
    h_inicio = settings.sla_hora_inicio_laboral if hora_inicio is None else hora_inicio
    h_fin = settings.sla_hora_fin_laboral if hora_fin is None else hora_fin
    pausa_inicio_utc = _a_utc(inicio_pausa)
    pausa_fin_utc = _a_utc(fin_pausa)
    if pausa_fin_utc <= pausa_inicio_utc:
        return timedelta(0)

    arranque_sla = _inicio_reloj_sla_utc(_a_utc(fecha_creacion), h_inicio, h_fin)
    inicio_contable = max(pausa_inicio_utc, arranque_sla)
    return max(pausa_fin_utc - inicio_contable, timedelta(0))


def _inicio_reloj_sla_utc(
    inicio_utc: datetime, hora_inicio: int, hora_fin: int
) -> datetime:
    inicio_local = inicio_utc.astimezone(_NEGOCIO_TZ)
    if _en_horario_laboral(inicio_local, hora_inicio, hora_fin):
        return inicio_utc
    return _proximo_inicio_laboral_utc(inicio_local, hora_inicio)


def _a_utc(dt: datetime) -> datetime:
    """Devuelve el timestamp como datetime AWARE en UTC.

    Los timestamps vienen de la DB como naive (UTC por convencion del
    proyecto). Si trae tzinfo, se convierte; si no, se asume UTC.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(ZoneInfo("UTC"))


def _en_horario_laboral(dt: datetime, hora_inicio: int, hora_fin: int) -> bool:
    """True si `dt` (ya en hora local del negocio) cae en [h_inicio, h_fin)."""
    return hora_inicio <= dt.hour < hora_fin


def _proximo_inicio_laboral_utc(
    inicio_local: datetime, hora_inicio: int
) -> datetime:
    """Calcula el proximo timestamp de arranque del reloj en UTC aware.

    `inicio_local` ya viene en hora local del negocio. Se devuelve un
    datetime AWARE en UTC, mismo tipo que `fin_utc` en el llamador.
    """
    if inicio_local.hour < hora_inicio:
        candidato_local = inicio_local.replace(
            hour=hora_inicio, minute=0, second=0, microsecond=0
        )
    else:
        candidato_local = (
            inicio_local.replace(
                hour=hora_inicio, minute=0, second=0, microsecond=0
            )
            + timedelta(days=1)
        )
    return candidato_local.astimezone(ZoneInfo("UTC"))
