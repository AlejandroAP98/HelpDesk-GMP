"""Tests del servicio de notificaciones via Telegram."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services import telegram_service
from app.services.telegram_service import (
    THROTTLE_PREFIX,
    is_telegram_enabled,
    notify_event,
)

_TICKET_ID = "11111111-1111-1111-1111-111111111111"


def _set_enabled(monkeypatch, token: str = "123:abc", chat_id: str = "-100123") -> None:
    monkeypatch.setattr(telegram_service.settings, "telegram_bot_token", token)
    monkeypatch.setattr(telegram_service.settings, "telegram_chat_id", chat_id)


def _evento_base(**overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = {
        "type": "ticket:new",
        "ticket_id": _TICKET_ID,
        "empresa_nombre": "GMP Redes",
        "titulo": "Torre caida",
        "prioridad": "alta",
        "estado": "abierto",
        "nombre_punto": "Sede Centro",
    }
    defaults.update(overrides)
    return defaults


@pytest.fixture(autouse=True)
def _redis_mock(monkeypatch):  # type: ignore[no-untyped-def]
    """Neutraliza el throttle de Redis para que los tests lleguen al envio.

    Redis SET nx devuelve True cuando la clave se crea (primer envio) y None
    cuando ya existia (throttle). True = permitido enviar.
    """
    monkeypatch.setattr(telegram_service.redis_client, "set", AsyncMock(return_value=True))


def _client_cls(post_return: Any = None, post_side: Any = None):  # type: ignore[no-untyped-def]
    class _ClientCM:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return None

        async def post(self, url: str, **kwargs):  # type: ignore[no-untyped-def]
            if post_side is not None:
                raise post_side
            return post_return

    return _ClientCM()


async def test_is_telegram_enabled_false_por_defecto(monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr(telegram_service.settings, "telegram_bot_token", "")
    monkeypatch.setattr(telegram_service.settings, "telegram_chat_id", "")
    assert is_telegram_enabled() is False


async def test_is_telegram_enabled_true_con_token_y_chat(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    assert is_telegram_enabled() is True


async def test_omitido_sin_token():  # type: ignore[no-untyped-def]
    ok = await notify_event(_evento_base())
    assert ok is False


async def test_omitido_evento_no_notificado(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    with patch.object(telegram_service.httpx, "AsyncClient") as client_mock:
        ok = await notify_event({"type": "ticket:paused", "ticket_id": _TICKET_ID})
    assert ok is False
    assert not client_mock.called


async def test_ticket_new_urgente_se_omite(monkeypatch):  # type: ignore[no-untyped-def]
    """El mensaje urgente (ticket:urgent_created) llega ademas de ticket:new;
    duplicarlo seria spam en el grupo."""
    _set_enabled(monkeypatch)
    with patch.object(telegram_service.httpx, "AsyncClient") as client_mock:
        ok = await notify_event(_evento_base(prioridad="urgente"))
    assert ok is False
    assert not client_mock.called


async def test_ticket_new_envia_mensaje(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    captured: dict = {}
    sent = MagicMock(status_code=200, text="ok")

    class _ClientCM:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return None

        async def post(self, url: str, **kwargs):  # type: ignore[no-untyped-def]
            captured.update({"url": url, **kwargs})
            return sent

    with patch.object(telegram_service.httpx, "AsyncClient", return_value=_ClientCM()):
        ok = await notify_event(_evento_base())
    assert ok is True
    assert captured["url"].startswith("https://api.telegram.org/bot123:abc/sendMessage")
    payload = captured["json"]
    assert payload["chat_id"] == "-100123"
    assert payload["parse_mode"] == "HTML"
    assert "Nuevo ticket en GMP Redes" in payload["text"]
    assert "Torre caida" in payload["text"]
    assert "Sede Centro" in payload["text"]
    assert f"/tickets/{_TICKET_ID}" in payload["text"]


async def test_urgente_incluye_marca(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    texto = telegram_service._render(
        _evento_base(type="ticket:urgent_created", prioridad="urgente"), "ticket:urgent_created"
    )
    assert "[URGENTE]" in texto
    assert "\U0001f534" in texto


async def test_comentario_trunca_contenido(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    largo = "x" * 500
    texto = telegram_service._render(
        {
            "type": "ticket:commented",
            "ticket_id": _TICKET_ID,
            "usuario_nombre": "Ana",
            "contenido": largo,
            "es_nota_interna": True,
        },
        "ticket:commented",
    )
    assert "nota interna" in texto
    assert "Ana" in texto
    assert "\u2026" in texto
    assert largo not in texto


async def test_comentario_escapa_html(monkeypatch):  # type: ignore[no-untyped-def]
    texto = telegram_service._render(
        {
            "type": "ticket:commented",
            "ticket_id": _TICKET_ID,
            "usuario_nombre": "<b>evil</b>",
            "contenido": "<script>x</script>",
            "es_nota_interna": False,
        },
        "ticket:commented",
    )
    assert "<script>" not in texto
    assert "&lt;script&gt;" in texto
    assert "<b>evil</b>" not in texto


async def test_state_changed_render(monkeypatch):  # type: ignore[no-untyped-def]
    texto = telegram_service._render(
        {
            "type": "ticket:state_changed",
            "ticket_id": _TICKET_ID,
            "titulo": "Torre caida",
            "estado_anterior": "abierto",
            "estado_nuevo": "en_progreso",
        },
        "ticket:state_changed",
    )
    assert "abierto \u2192" in texto
    assert "en_progreso" in texto


async def test_actividad_nueva_render(monkeypatch):  # type: ignore[no-untyped-def]
    texto = telegram_service._render(
        {
            "type": "actividad:nueva",
            "ticket_id": _TICKET_ID,
            "actividad": {
                "tipo_evento": "priority_changed",
                "usuario_nombre": "Admin",
                "ticket_id": _TICKET_ID,
                "metadata": {"prioridad_anterior": "baja", "prioridad_nueva": "urgente"},
            },
        },
        "actividad:nueva",
    )
    assert "Admin" in texto
    assert "baja" in texto
    assert "urgente" in texto


async def test_rechazo_4xx_sin_reintento(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    rejected = MagicMock(status_code=422, text="bad request")
    with patch.object(
        telegram_service.httpx, "AsyncClient", return_value=_client_cls(post_return=rejected)
    ):
        ok = await notify_event(_evento_base())
    assert ok is False


async def test_reintenta_en_connect_error(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    monkeypatch.setattr(telegram_service, "_RETRY_DELAYS", [0.01, 0.01])
    contador = {"n": 0}

    class _ClientCM:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return None

        async def post(self, url: str, **kwargs):  # type: ignore[no-untyped-def]
            contador["n"] += 1
            if contador["n"] < 3:
                raise httpx.ConnectError("connection failed")
            return MagicMock(status_code=200, text="ok")

    with patch.object(telegram_service.httpx, "AsyncClient", return_value=_ClientCM()):
        ok = await notify_event(_evento_base())
    assert ok is True
    assert contador["n"] == 3


async def test_falla_definitivo_tras_max_reintentos(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    monkeypatch.setattr(telegram_service, "_RETRY_DELAYS", [0.01, 0.01])
    contador = {"n": 0}

    class _ClientCM:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return None

        async def post(self, url: str, **kwargs):  # type: ignore[no-untyped-def]
            contador["n"] += 1
            raise httpx.ConnectError("connection failed")

    with patch.object(telegram_service.httpx, "AsyncClient", return_value=_ClientCM()):
        ok = await notify_event(_evento_base())
    assert ok is False
    assert contador["n"] == 3


async def test_throttle_por_tipo_y_ticket(monkeypatch):  # type: ignore[no-untyped-def]
    _set_enabled(monkeypatch)
    llamadas: list[tuple[str, dict]] = []

    class _FakeRedis:
        async def set(self, key: str, value: Any = None, **kwargs: Any):  # type: ignore[no-untyped-def]
            if any(k == key for k, _ in llamadas):
                return None
            llamadas.append((key, kwargs))
            return True

    monkeypatch.setattr(telegram_service, "redis_client", _FakeRedis())
    with patch.object(
        telegram_service.httpx,
        "AsyncClient",
        return_value=_client_cls(post_return=MagicMock(status_code=200, text="ok")),
    ):
        llamadas.clear()
        ok1 = await notify_event(_evento_base())
        ok2 = await notify_event(_evento_base())
    assert ok1 is True
    assert ok2 is False
    assert llamadas[0][0] == f"{THROTTLE_PREFIX}ticket:new:{_TICKET_ID}"
