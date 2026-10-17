"""Configuracion de pytest para tests async con DB limpia por test."""

from __future__ import annotations

import os
from io import BytesIO
from typing import AsyncIterator
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Asegurar que use la DB de testing (override del .env) - debe ir BEFORE imports de app
TEST_DB_NAME = os.environ.get("TEST_DB_NAME", "helpdesk_test")
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    f"postgresql+asyncpg://helpdesk:helpdesk@postgres:5432/{TEST_DB_NAME}",
)
ADMIN_DB_URL = "postgresql+asyncpg://helpdesk:helpdesk@postgres:5432/postgres"

os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["APP_ENV"] = "test"
# Jamas enviar emails reales desde tests (cero consumo de cuota de Resend).
# Las variables de entorno tienen precedencia sobre cualquier .env; deben setearse
# ANTES de que app.core.config instancie settings.
os.environ["RESEND_API_KEY"] = ""
os.environ["RESEND_URGENT_RECIPIENTS"] = ""


async def _asegurar_db_test() -> None:
    """Crea la DB de test (idempotente) y aplica el schema ORM."""
    admin = create_async_engine(ADMIN_DB_URL, isolation_level="AUTOCOMMIT")
    try:
        async with admin.connect() as conn:
            existe = (
                await conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :n"),
                    {"n": TEST_DB_NAME},
                )
            ).scalar()
            if not existe:
                await conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    finally:
        await admin.dispose()

    from app.core.database import Base
    import app.models  # noqa: F401 - registra modelos en Base.metadata

    setup_engine = create_async_engine(TEST_DB_URL)
    try:
        async with setup_engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
            await conn.run_sync(Base.metadata.create_all)
    finally:
        await setup_engine.dispose()


def _override_app_engine() -> None:
    """Reemplaza AsyncSessionLocal del modulo app.core.database con uno apuntando a DB test."""
    import app.core.database as db_mod

    new_engine = create_async_engine(TEST_DB_URL, pool_pre_ping=True, pool_size=5)
    db_mod.engine = new_engine
    db_mod.AsyncSessionLocal = async_sessionmaker(
        new_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )


TABLAS = [
    "tareas_pendientes",
    "respuestas_rapidas",
    "historial_estados",
    "adjuntos",
    "comentarios",
    "tickets",
    "push_subscriptions",
    "puntos_venta",
    "matriz_prioridad",
    "subcategorias",
    "usuarios",
    "categorias",
    "empresas",
]


async def _truncate(engine: AsyncEngine) -> None:
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        for t in reversed(TABLAS):
            await s.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE'))
        await s.commit()


@pytest_asyncio.fixture
async def db_engine() -> AsyncIterator[AsyncEngine]:
    """Engine de test por test + asegura schema + override de la app."""
    await _asegurar_db_test()
    _override_app_engine()
    engine = create_async_engine(TEST_DB_URL, pool_pre_ping=True, pool_size=5)
    # Limpia estado previo (corridas anteriores pueden haber dejado datos)
    await _truncate(engine)
    try:
        yield engine
    finally:
        await _truncate(engine)
        await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Sesion exclusiva para helpers de test (seed_*)."""
    Session = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """Cliente HTTP sobre la app real. La app usa get_db con el engine de test."""
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _fake_s3(body: bytes = b"fake-image-bytes") -> MagicMock:
    mock = MagicMock()
    stored: dict[str, bytes] = {}

    def _upload(Fileobj=None, **_kwargs):  # type: ignore[no-untyped-def]
        if Fileobj is not None:
            data = Fileobj.read() if hasattr(Fileobj, "read") else Fileobj
            stored[_kwargs.get("Key", "")] = bytes(data)

    mock.upload_fileobj = MagicMock(side_effect=_upload)
    mock.delete_object = MagicMock(return_value=None)

    def _get(Bucket=None, Key=None, Range=None, **_kwargs):  # type: ignore[no-untyped-def]
        data = stored.get(Key or "", body)
        total = len(data)
        if Range:
            _range, end = Range.replace("bytes=", "").split("-")
            start = int(_range)
            end = int(end) if end else total - 1
            data = data[start : end + 1]
        return {
            "Body": BytesIO(data),
            "ContentLength": len(data),
            "ContentRange": f"bytes {0}-{len(data) - 1}/{total}" if Range else None,
        }

    mock.get_object = MagicMock(side_effect=_get)
    return mock


@pytest.fixture
def s3_mock():
    """Parchea el cliente S3 singleton del storage para evitar tocar MinIO real."""
    mock = _fake_s3()
    with patch("app.core.storage._s3_client", mock):
        yield mock
