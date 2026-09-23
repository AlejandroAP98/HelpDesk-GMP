"""Smoke test del setup de pytest."""
from __future__ import annotations

from app.core.database import Base
import app.models  # noqa: F401


def test_setup_tablas() -> None:
    tablas = set(Base.metadata.tables.keys())
    assert {"empresas", "usuarios", "categorias", "tickets", "comentarios", "adjuntos"}.issubset(tablas)


async def test_db_liente(client) -> None:  # type: ignore[no-untyped-def]
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


async def test_emails_desactivados_en_tests() -> None:
    """Guard: ningun test debe poder enviar emails reales (cuota de Resend)."""
    from app.services import email_service

    assert email_service.is_email_enabled() is False