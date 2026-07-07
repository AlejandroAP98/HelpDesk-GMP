"""Tests del scheduler de cierre automatico de tickets resueltos.

Replica la logica SQL de `scheduler/scheduler/main.py::cerrar_tickets_resueltos`
directamente con `text()`, ya que el modulo `scheduler` no esta dentro del
contenedor backend.
"""
from __future__ import annotations

import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://helpdesk:helpdesk@postgres:5432/helpdesk_test",
)


async def _cerrar_resueltos(engine, dias: int) -> int:  # type: ignore[no-untyped-def]
    """Sql logic identica a scheduler.main.cerrar_tickets_resueltos."""
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        stmt = text(
            """
            UPDATE tickets
            SET estado = 'cerrado',
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE estado = 'resuelto'
              AND fecha_actualizacion < CURRENT_TIMESTAMP - make_interval(days => :dias)
            """
        ).bindparams(dias=dias)
        result = await s.execute(stmt)
        await s.commit()
        return result.rowcount or 0


async def _limpiar_y_popular(engine, antiguo: bool, reciente: bool) -> None:  # type: ignore[no-untyped-def]
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        for t in ["adjuntos", "comentarios", "tickets", "usuarios", "categorias", "empresas"]:
            await s.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE'))
        await s.commit()

        await s.execute(text("INSERT INTO empresas (id, nombre) VALUES (1, 'E')"))
        await s.execute(
            text(
                "INSERT INTO usuarios (nombre, email, password_hash, rol, empresa_id) "
                "VALUES ('Admin', 's1@test.com', 'x', 'administrador', 1) RETURNING id"
            )
        )
        uid = (await s.execute(text("SELECT id FROM usuarios WHERE email='s1@test.com'"))).scalar()
        await s.execute(text("INSERT INTO categorias (id, nombre) VALUES (1, 'X')"))
        if antiguo:
            await s.execute(
                text(
                    "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, titulo, descripcion, estado, prioridad, fecha_actualizacion) "
                    "VALUES (1, :u, 1, 'T_old', 'D', 'resuelto', 'media', CURRENT_TIMESTAMP - INTERVAL '30 days')"
                ),
                {"u": uid},
            )
        if reciente:
            await s.execute(
                text(
                    "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, titulo, descripcion, estado, prioridad, fecha_actualizacion) "
                    "VALUES (1, :u, 1, 'T_recent', 'D', 'resuelto', 'media', CURRENT_TIMESTAMP - INTERVAL '1 day')"
                ),
                {"u": uid},
            )
        await s.commit()


async def test_cerrar_tickets_resueltos_cierra_solo_antiguos() -> None:
    engine = create_async_engine(TEST_DB_URL, pool_pre_ping=True)
    try:
        await _limpiar_y_popular(engine, antiguo=True, reciente=True)
        cerrados = await _cerrar_resueltos(engine, dias=7)
        assert cerrados == 1, f"Esperaba 1 cerrado, obtuve {cerrados}"

        Session = async_sessionmaker(engine, expire_on_commit=False)
        async with Session() as s:
            old = (await s.execute(text("SELECT estado FROM tickets WHERE titulo='T_old'"))).scalar()
            recent = (await s.execute(text("SELECT estado FROM tickets WHERE titulo='T_recent'"))).scalar()
            assert old == "cerrado"
            assert recent == "resuelto"
    finally:
        await engine.dispose()


async def test_idempotente_segunda_corrida_cero() -> None:
    engine = create_async_engine(TEST_DB_URL, pool_pre_ping=True)
    try:
        await _limpiar_y_popular(engine, antiguo=True, reciente=False)
        c1 = await _cerrar_resueltos(engine, 7)
        c2 = await _cerrar_resueltos(engine, 7)
        assert c1 == 1
        assert c2 == 0
    finally:
        await engine.dispose()


async def test_no_cierra_si_umbral_es_mayor_a_30_dias() -> None:
    """Si el umbral subir a 60 dias, no se cierran tickets de 30 dias."""
    engine = create_async_engine(TEST_DB_URL, pool_pre_ping=True)
    try:
        await _limpiar_y_popular(engine, antiguo=True, reciente=False)
        c = await _cerrar_resueltos(engine, dias=60)
        assert c == 0  # Viejo de 30 dias pero umbral 60 no se cierra
    finally:
        await engine.dispose()


async def test_no_cierra_tickets_no_resueltos() -> None:
    engine = create_async_engine(TEST_DB_URL, pool_pre_ping=True)
    try:
        await _limpiar_y_popular(engine, antiguo=False, reciente=False)
        Session = async_sessionmaker(engine, expire_on_commit=False)
        async with Session() as s:
            uid = (await s.execute(text("SELECT id FROM usuarios WHERE email='s1@test.com'"))).scalar()
            await s.execute(
                text(
                    "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, titulo, descripcion, estado, prioridad, fecha_actualizacion) "
                    "VALUES (1, :u, 1, 'T_abierto', 'D', 'abierto', 'media', CURRENT_TIMESTAMP - INTERVAL '100 days')"
                ),
                {"u": uid},
            )
            await s.commit()
        c = await _cerrar_resueltos(engine, 7)
        assert c == 0
    finally:
        await engine.dispose()