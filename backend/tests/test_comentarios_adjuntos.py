"""Tests de comentarios: visibilidad por rol y notas internas."""
from __future__ import annotations

from tests.helpers import (
    auth_header,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_usuario,
)


async def _crear_ticket(client, tok):  # type: ignore[no-untyped-def]
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={"titulo": "T", "descripcion": "D", "categoria_id": 1, "prioridad": "media"},
    )
    return r.json()["id"]


async def test_comentario_publico_visible_cliente(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_usuario(db_session, email="a@test.com", password="Password12345", rol="agente")
    await seed_categoria(db_session, nombre="HW")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")
    tid = await _crear_ticket(client, tok_c)

    r = await client.post(
        f"/api/tickets/{tid}/comentarios",
        headers=auth_header(tok_a),
        json={"contenido": "Hola, vi tu ticket", "es_nota_interna": False},
    )
    assert r.status_code == 201

    r2 = await client.get(f"/api/tickets/{tid}/comentarios", headers=auth_header(tok_c))
    assert r2.status_code == 200
    assert len(r2.json()) == 1
    assert r2.json()[0]["es_nota_interna"] is False


async def test_nota_interna_oculta_a_cliente(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_usuario(db_session, email="a@test.com", password="Password12345", rol="agente")
    await seed_categoria(db_session, nombre="HW")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")
    tid = await _crear_ticket(client, tok_c)

    # Agente publica
    await client.post(
        f"/api/tickets/{tid}/comentarios",
        headers=auth_header(tok_a),
        json={"contenido": "publico", "es_nota_interna": False},
    )
    # Agente nota interna
    await client.post(
        f"/api/tickets/{tid}/comentarios",
        headers=auth_header(tok_a),
        json={"contenido": "secreto", "es_nota_interna": True},
    )

    # Cliente ve solo 1 (el publico)
    r = await client.get(f"/api/tickets/{tid}/comentarios", headers=auth_header(tok_c))
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["contenido"] == "publico"

    # Agente ve 2
    r2 = await client.get(f"/api/tickets/{tid}/comentarios", headers=auth_header(tok_a))
    assert len(r2.json()) == 2


async def test_cliente_no_puede_crear_nota_interna_403(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_categoria(db_session, nombre="HW")
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)

    r = await client.post(
        f"/api/tickets/{tid}/comentarios",
        headers=auth_header(tok),
        json={"contenido": "x", "es_nota_interna": True},
    )
    assert r.status_code == 403


async def test_admin_lista_todas_las_empresas(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="E1")
    await seed_empresa(db_session, pk=2, nombre="E2")
    await seed_usuario(db_session, email="c1@test.com", password="P12345678", rol="cliente", empresa_id=1)
    await seed_usuario(db_session, email="c2@test.com", password="P12345678", rol="cliente", empresa_id=2)
    await seed_usuario(db_session, email="adm@test.com", password="Password12345", rol="administrador")
    await seed_categoria(db_session, nombre="HW")

    await client.post(
        "/api/tickets",
        headers=auth_header(await login_token(client, "c1@test.com", "P12345678")),
        json={"titulo": "T1", "descripcion": "D", "categoria_id": 1, "prioridad": "media"},
    )
    await client.post(
        "/api/tickets",
        headers=auth_header(await login_token(client, "c2@test.com", "P12345678")),
        json={"titulo": "T2", "descripcion": "D", "categoria_id": 1, "prioridad": "media"},
    )
    tok_adm = await login_token(client, "adm@test.com", "Password12345")
    r = await client.get("/api/tickets", headers=auth_header(tok_adm))
    assert r.status_code == 200
    assert r.json()["total"] == 2