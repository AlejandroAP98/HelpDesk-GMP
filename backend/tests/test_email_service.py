"""Tests del servicio de emails transaccionales via Resend."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import email_service
from app.services.email_service import (
    is_email_enabled,
    send_ticket_resolved,
    send_ticket_created,
    send_ticket_urgent,
)


def _fake_ticket(**overrides):  # type: ignore[no-untyped-def]
    defaults = {
        "id": "11111111-1111-1111-1111-111111111111",
        "titulo": "Pantalla en blanco",
        "descripcion": "No enciende",
        "prioridad": MagicMock(value="urgente"),
        "estado": MagicMock(value="abierto"),
    }
    defaults.update(overrides)
    t = MagicMock()
    for k, v in defaults.items():
        setattr(t, k, v)
    return t


async def test_is_email_enabled_false_por_defecto(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "")
    assert is_email_enabled() is False


async def test_is_email_enabled_true_con_api_key(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    assert is_email_enabled() is True


async def test_send_devuelve_false_sin_api_key(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "")
    ticket = _fake_ticket()
    ok = await send_ticket_created(ticket, "cliente@ejemplo.com")
    assert ok is False


async def test_send_omite_sin_recipient_en_urgente(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test")
    monkeypatch.setattr(email_service.settings, "resend_urgent_recipients", "")
    ticket = _fake_ticket()
    ok = await send_ticket_urgent(ticket, "Empresa X")
    assert ok is False


async def test_send_ticket_created_llama_resend(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    monkeypatch.setattr(
        email_service.settings, "resend_from_email", "HelpDesk <n@helpdesk.com>"
    )
    response_mock = MagicMock(status_code=200, text="ok")
    with patch.object(
        email_service.httpx, "AsyncClient", return_value=MagicMock(
            __aenter__=AsyncMock(return_value=MagicMock(
                post=AsyncMock(return_value=response_mock),
            )),
            __aexit__=AsyncMock(return_value=None),
        )
    ) as client_cls:
        ticket = _fake_ticket()
        ok = await send_ticket_created(ticket, "cliente@ejemplo.com")
    assert ok is True
    assert client_cls.called
    post = client_cls.return_value.__aenter__.return_value.post
    call = post.call_args
    assert call.args[0] == email_service.RESEND_API_URL
    payload = call.kwargs["json"]
    assert payload["to"] == ["cliente@ejemplo.com"]
    assert "HelpDesk" in payload["from"]
    assert "Pantalla en blanco" in payload["subject"]
    assert "11111111" in payload["html"]


async def test_send_ticket_resolved_llama_resend(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    monkeypatch.setattr(
        email_service.settings, "resend_from_email", "HelpDesk <n@helpdesk.com>"
    )
    response_mock = MagicMock(status_code=200, text="ok")
    with patch.object(
        email_service.httpx, "AsyncClient", return_value=MagicMock(
            __aenter__=AsyncMock(return_value=MagicMock(
                post=AsyncMock(return_value=response_mock),
            )),
            __aexit__=AsyncMock(return_value=None),
        )
    ):
        ticket = _fake_ticket()
        ok = await send_ticket_resolved(ticket, "cliente@ejemplo.com")
    assert ok is True


async def test_send_ticket_urgent_multiple_recipients(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    monkeypatch.setattr(
        email_service.settings,
        "resend_urgent_recipients",
        "ops@gmpredes.online,ceo@gmpredes.online",
    )
    captured: dict = {}

    class _ClientCM:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return None

        async def post(self, url, **kwargs):  # type: ignore[no-untyped-def]
            captured.update(kwargs)
            return MagicMock(status_code=200, text="ok")

    with patch.object(email_service.httpx, "AsyncClient", return_value=_ClientCM()):
        ticket = _fake_ticket()
        ok = await send_ticket_urgent(ticket, "Empresa X")
    assert ok is True
    assert captured["json"]["to"] == [
        "ops@gmpredes.online",
        "ceo@gmpredes.online",
    ]
    assert "URGENTE" in captured["json"]["subject"]


async def test_send_devuelve_false_si_resend_rechaza(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    response_mock = MagicMock(status_code=422, text="validation failed")

    class _ClientCM:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return None

        async def post(self, url, **kwargs):  # type: ignore[no-untyped-def]
            return response_mock

    with patch.object(email_service.httpx, "AsyncClient", return_value=_ClientCM()):
        ticket = _fake_ticket()
        ok = await send_ticket_created(ticket, "cliente@ejemplo.com")
    assert ok is False


async def test_send_no_falla_si_httpx_tira_excepcion(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")

    class _ClientCM:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return None

        async def post(self, url, **kwargs):  # type: ignore[no-untyped-def]
            raise ConnectionError("network down")

    with patch.object(email_service.httpx, "AsyncClient", return_value=_ClientCM()):
        ticket = _fake_ticket()
        ok = await send_ticket_created(ticket, "cliente@ejemplo.com")
    assert ok is False


async def test_send_ticket_created_sin_email_cliente(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    ticket = _fake_ticket()
    ok = await send_ticket_created(ticket, "")
    assert ok is False
