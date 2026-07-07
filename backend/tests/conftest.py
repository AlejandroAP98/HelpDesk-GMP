"""Configuracion de pytest para tests async con DB limpia por test."""
from __future__ import annotations

import os
from typing import AsyncIterator

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


TABLAS = ["adjuntos", "comentarios", "tickets", "usuarios", "categorias", "empresas"]


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