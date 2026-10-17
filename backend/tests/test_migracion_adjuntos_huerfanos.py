"""Test de la migracion de adjuntos huérfanos a comentarios."""
from __future__ import annotations

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.adjunto import Adjunto
from app.models.comentario import Comentario
from tests.conftest import TEST_DB_URL
from tests.helpers import (
    auth_header,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_subcategoria,
    seed_usuario,
)


def _run_alembic(url: str, target: str) -> None:
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    # El schema ya fue creado por Base.metadata.create_all; marcamos la revision
    # anterior para ejecutar solo la migracion de datos bajo prueba.
    command.stamp(cfg, "17452f650426")
    command.upgrade(cfg, target)


def _downgrade_alembic(url: str, target: str) -> None:
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.downgrade(cfg, target)


def _restaurar_head(url: str) -> None:
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "b263a3fcd3d8")
    command.stamp(cfg, "c4d5e6f7a8b9")


@pytest.mark.asyncio
async def test_migracion_adjuntos_huerfanos_crea_comentario(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    admin = await seed_usuario(
        db_session, email="adm@test.com", password="Password12345", rol="administrador"
    )
    await seed_usuario(
        db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")

    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={
            "titulo": "T",
            "descripcion": "D",
            "categoria_id": 1,
            "subcategoria_id": 1,
            "elemento_afectado": "punto_venta",
            "prioridad": "media",
        },
    )
    assert r.status_code == 201, r.text
    ticket_id = r.json()["id"]

    mensaje_migracion = (
        "Se adjuntan las imágenes de este ticket en un comentario por cambio en la interfaz."
    )
    await db_session.execute(
        text(
            "INSERT INTO comentarios "
            "(ticket_id, usuario_id, contenido, es_nota_interna) "
            "VALUES (:ticket_id, :usuario_id, :contenido, false), "
            "(:ticket_id, :usuario_id, NULL, false)"
        ),
        {
            "ticket_id": ticket_id,
            "usuario_id": str(admin.id),
            "contenido": mensaje_migracion,
        },
    )

    # Adjunto huérfano (subido directamente al ticket, sin comentario)
    await db_session.execute(
        text(
            """
            INSERT INTO adjuntos (ticket_id, archivo_url, nombre_archivo, tipo_mime, tamano_bytes)
            VALUES (:ticket_id, 'bucket/tickets/test/key.jpg', 'foto.jpg', 'image/jpeg', 123)
            """
        ),
        {"ticket_id": ticket_id},
    )
    await db_session.commit()

    # Ejecutar migracion
    sync_url = TEST_DB_URL.replace("+asyncpg", "+psycopg2")
    _run_alembic(sync_url, "b263a3fcd3d8")

    # Verificar que el adjunto quedó ligado a un comentario del admin
    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        adjunto = (await s.execute(select(Adjunto))).scalar_one()
        assert adjunto.comentario_id is not None

        comentario = (
            await s.execute(select(Comentario).where(Comentario.id == adjunto.comentario_id))
        ).scalar_one()
        assert str(comentario.ticket_id) == ticket_id
        assert comentario.usuario_id == admin.id
        assert comentario.es_nota_interna is False
        assert "cambio en la interfaz" in (comentario.contenido or "")

    # El downgrade conserva el comentario migrado y otro comentario legitimo
    # con el mismo texto, y adapta los comentarios sin texto al schema anterior.
    try:
        _downgrade_alembic(sync_url, "dd11cc22ee33")
        async with Session() as s:
            comentarios = (
                await s.execute(select(Comentario).where(Comentario.ticket_id == ticket_id))
            ).scalars().all()
            assert sum(c.contenido == mensaje_migracion for c in comentarios) == 2
            assert all(c.contenido is not None for c in comentarios)
            adjunto = (await s.execute(select(Adjunto))).scalar_one()
            assert adjunto.comentario_id is not None
    finally:
        _restaurar_head(sync_url)
