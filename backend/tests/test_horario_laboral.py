"""Tests unitarios del helper de horario laboral.

Cubren los casos del SLA:
- Ticket que se crea DENTRO del horario -> reloj arranca inmediato,
  corre continuo.
- Ticket que se crea FUERA del horario -> reloj arranca al proximo
  inicio de jornada y desde ahi corre continuo.
- Bordes exactos 7:00:00 / 21:00:00.
- `fin <= arranque_real` -> timedelta(0).
- Timestamps con y sin tzinfo (los naive se asumen UTC, como en la DB).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from app.services.horario_laboral import (
    tiempo_pausa_sla_transcurrido,
    tiempo_sla_transcurrido,
)
from app.services import ticket_service


BOGOTA = ZoneInfo("America/Bogota")


def _b(hour: int, minute: int = 0, day: int = 2, month: int = 3, year: int = 2026) -> datetime:
    """Helper: timestamp en hora local de Bogota con tzinfo."""
    return datetime(year, month, day, hour, minute, tzinfo=BOGOTA)


def _u(hour: int, minute: int = 0, day: int = 2, month: int = 3, year: int = 2026) -> datetime:
    """Helper: timestamp naive (interpretado como UTC por el helper, como
    los valores que devuelve la DB)."""
    return datetime(year, month, day, hour, minute)


def test_misma_hora_en_horario() -> None:
    assert tiempo_sla_transcurrido(_b(10, 0), _b(10, 0)) == timedelta(0)


def test_dos_horas_dentro_de_horario() -> None:
    inicio = _b(9, 0)
    fin = _b(11, 0)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=2)


def test_cruza_21h_nacido_en_horario_sigue_contando() -> None:
    """Nacido 18:00 Bogota, resuelto 23:30 -> 5h30m en reloj continuo."""
    delta = tiempo_sla_transcurrido(_b(18, 0), _b(23, 30))
    assert delta == timedelta(hours=5, minutes=30)


def test_nacido_en_horario_y_resuelto_al_siguiente_dia() -> None:
    """Nacido 18:00 Bogota, resuelto 11:00 dia siguiente -> 17h continuo."""
    inicio = _b(18, 0)
    fin = _b(11, 0, day=3)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=17)


def test_nacido_22h_arranca_07h_siguiente() -> None:
    """Nacido 22:00 Bogota, resuelto 08:00 dia siguiente -> 1h (08 - 07)."""
    inicio = _b(22, 0)
    fin = _b(8, 0, day=3)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=1)


def test_nacido_03h_arranque_mismo_dia_07h() -> None:
    """Nacido 03:00 Bogota, resuelto 11:00 mismo dia -> 4h (11 - 07)."""
    inicio = _b(3, 0)
    fin = _b(11, 0)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=4)


def test_nacido_de_noche_y_resuelto_antes_de_07h_siguiente_da_cero() -> None:
    """El agente-hero contesta a las 5am, antes del arranque (07:00) -> 0h."""
    inicio = _b(22, 0)
    fin = _b(5, 0, day=3)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(0)


def test_borde_exacto_07h_arranca_inmediato() -> None:
    """07:00:00 cae en horario laboral -> el reloj arranca en ese instante."""
    inicio = _b(7, 0)
    fin = _b(8, 0)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=1)


def test_borde_exacto_21h_arranca_dia_siguiente() -> None:
    """21:00:00 cae FUERA del horario -> arranca al dia siguiente 07:00."""
    inicio = _b(21, 0)
    fin = _b(9, 0, day=3)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=2)


def test_borde_06_59_arranca_mismo_dia() -> None:
    """06:59 esta antes de las 07:00 -> arranque a las 07:00 del mismo dia."""
    inicio = _b(6, 59)
    fin = _b(10, 0)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=3)


def test_fin_anterior_a_inicio_da_cero() -> None:
    inicio = _b(10, 0)
    fin = _b(9, 0)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(0)


def test_nacido_de_noche_contestando_dia_siguiente_tarde() -> None:
    """Caso de referencia: creado 22:00 Bogota, resuelto 21:30 dia siguiente.
    Arranque 07:00 dia siguiente, fin 21:30 dia siguiente -> 14h30m."""
    inicio = _b(22, 0)
    fin = _b(21, 30, day=3)
    assert tiempo_sla_transcurrido(inicio, fin) == timedelta(hours=14, minutes=30)


def test_horas_personalizadas_8_a_18() -> None:
    """Verifica que el helper respeta horas fuera de los defaults.
    Con 8-18h el inicio (17h Bogota) esta en horario -> delta continuo 2h."""
    inicio = _b(17, 0)
    fin = _b(19, 0)
    assert tiempo_sla_transcurrido(inicio, fin, hora_inicio=8, hora_fin=18) == timedelta(hours=2)


def test_horas_personalizadas_8_a_18_inicio_fuera() -> None:
    """Con horario 8-18, inicio a las 19h Bogota -> arranque al dia siguiente 8h.
    Resuelto 10:00 -> 2h (10 - 8)."""
    inicio = _b(19, 0)
    fin = _b(10, 0, day=3)
    delta = tiempo_sla_transcurrido(inicio, fin, hora_inicio=8, hora_fin=18)
    assert delta == timedelta(hours=2)


def test_pausa_completamente_antes_del_arranque_sla_no_se_descuenta() -> None:
    creado = _b(22, 0)
    inicio_pausa = _b(3, 0, day=3)
    fin_pausa = _b(6, 0, day=3)
    assert (
        tiempo_pausa_sla_transcurrido(creado, inicio_pausa, fin_pausa)
        == timedelta(0)
    )


def test_pausa_que_cruza_arranque_sla_descuenta_solo_la_interseccion() -> None:
    creado = _b(22, 0)
    inicio_pausa = _b(6, 0, day=3)
    fin_pausa = _b(8, 0, day=3)
    assert (
        tiempo_pausa_sla_transcurrido(creado, inicio_pausa, fin_pausa)
        == timedelta(hours=1)
    )


def test_pausa_de_ticket_nacido_en_horario_se_descuenta_completa() -> None:
    creado = _b(18, 0)
    inicio_pausa = _b(20, 0)
    fin_pausa = _b(23, 0)
    assert (
        tiempo_pausa_sla_transcurrido(creado, inicio_pausa, fin_pausa)
        == timedelta(hours=3)
    )


def test_acumular_pausa_guarda_tiempo_total_y_tiempo_sla_por_separado(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return datetime(2026, 10, 11, 11, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(ticket_service, "datetime", FrozenDateTime)
    ticket = SimpleNamespace(
        fecha_creacion=datetime(2026, 10, 11, 3, 0),
        fecha_pausa=datetime(2026, 10, 11, 9, 0),
        en_pausa=True,
        motivo_pausa="espera",
        segundos_pausa_acumulado=0,
        segundos_pausa_sla_acumulado=0,
    )

    ticket_service._acumular_tiempo_pausa(ticket)

    assert ticket.segundos_pausa_acumulado == 2 * 60 * 60
    assert ticket.segundos_pausa_sla_acumulado == 0
    assert ticket.en_pausa is False
    assert ticket.fecha_pausa is None


def test_naive_se_interpreta_como_utc() -> None:
    """Timestamps naive (formato DB) se interpretan como UTC.
    2026-10-10 07:00:00 UTC = 02:00 Bogota -> fuera de horario."""
    inicio = datetime(2026, 10, 10, 7, 0)
    fin = datetime(2026, 10, 10, 15, 0)
    delta = tiempo_sla_transcurrido(inicio, fin)
    assert delta == timedelta(hours=3)


@pytest.mark.parametrize(
    "creado_utc, fin_utc, esperado_horas",
    [
        ("2026-10-10 07:00:00", "2026-10-10 15:00:00", 3.0),  # Caso 1
        ("2026-10-10 14:00:00", "2026-10-10 16:00:00", 2.0),  # Caso 2
        ("2026-10-10 19:00:00", "2026-10-10 19:00:00", 0.0),  # Caso 7
        ("2026-10-10 23:00:00", "2026-10-11 14:00:00", 15.0),  # Caso 3
        ("2026-10-11 01:00:00", "2026-10-11 07:00:00", 6.0),  # Caso 4
        ("2026-10-11 03:00:00", "2026-10-11 10:00:00", 0.0),  # Caso 5
        ("2026-10-11 04:00:00", "2026-10-11 14:00:00", 2.0),  # Caso 6
    ],
)
def test_tickets_fix_horario(
    creado_utc: str, fin_utc: str, esperado_horas: float
) -> None:
    """Replica los 7 casos de los tickets [FIX-HORARIO] del seed manual.

    Los timestamps vienen de la DB como naive UTC. El helper los convierte
    a Bogota (UTC-5) y aplica la regla de horario.
    """
    creado = datetime.strptime(creado_utc, "%Y-%m-%d %H:%M:%S")
    fin = datetime.strptime(fin_utc, "%Y-%m-%d %H:%M:%S")
    delta = tiempo_sla_transcurrido(creado, fin)
    horas = delta.total_seconds() / 3600.0
    assert abs(horas - esperado_horas) < 0.001


@pytest.mark.parametrize(
    "creado_utc, fin_utc, esperado_minutos",
    [
        ("2026-10-14 12:00:00", "2026-10-14 14:00:00", 120),  # E1: 07:00 -> 09:00
        ("2026-10-15 01:59:00", "2026-10-15 02:30:00", 31),  # E2: 20:59 -> 21:30
        ("2026-10-15 02:00:00", "2026-10-15 13:00:00", 60),  # E3: 21:00 -> 08:00
        ("2026-10-14 15:00:00", "2026-10-17 15:00:00", 4320),  # E4: 3 dias -> 72h
        ("2026-10-14 15:00:00", "2026-10-14 19:00:00", 240),  # E5: base 4h (pausa aparte)
        ("2026-10-15 03:00:00", "2026-10-15 12:00:00", 0),  # E6: 22:00 -> 07:00
        ("2026-10-12 04:00:00", "2026-10-12 15:00:00", 180),  # E7: sab 23:00 -> dom 10:00
        ("2026-10-14 15:00:00", "2026-10-14 14:00:00", 0),  # E8: fin anterior a inicio
    ],
)
def test_tickets_fix_horario_extra(
    creado_utc: str, fin_utc: str, esperado_minutos: float
) -> None:
    """Casos edge adicionales ([FIX-HORARIO-EXTRA])."""
    creado = datetime.strptime(creado_utc, "%Y-%m-%d %H:%M:%S")
    fin = datetime.strptime(fin_utc, "%Y-%m-%d %H:%M:%S")
    delta = tiempo_sla_transcurrido(creado, fin)
    minutos = delta.total_seconds() / 60.0
    assert abs(minutos - esperado_minutos) < 0.001
