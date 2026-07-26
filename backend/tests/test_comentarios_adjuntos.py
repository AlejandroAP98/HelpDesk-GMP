"""Tests de comentarios: visibilidad por rol y notas internas."""
from __future__ import annotations

from sqlalchemy import select

from app.models.ticket import Ticket
from app.services.comentario_service import _resolve_implicated_user_ids
from tests.helpers import (
    auth_header,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_subcategoria,
    seed_usuario,
)


async def _crear_ticket(client, tok):  # type: ignore[no-untyped-def]
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
    return r.json()["id"]


async def _asignar_ticket(db_session, tid, agente_id):  # type: ignore[no-untyped-def]
    """Asigna un agente al ticket directamente en la DB (para tests)."""
    ticket = (await db_session.execute(select(Ticket).where(Ticket.id == tid))).scalar_one()
    ticket.agente_id = agente_id
    ticket.estado = "asignado"
    await db_session.commit()


async def test_comentario_publico_visible_cliente(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    agente = await seed_usuario(db_session, email="a@test.com", password="Password12345", rol="agente")
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")
    tid = await _crear_ticket(client, tok_c)
    await _asignar_ticket(db_session, tid, agente.id)

    r = await client.post(
        f"/api/tickets/{tid}/comentarios",
        headers=auth_header(tok_a),
        json={"contenido": "Hola, vi tu ticket", "es_nota_interna": False},
    )
    assert r.status_code == 201

    r2 = await client.get(f"/api/tickets/{tid}/comentarios", headers=auth_header(tok_c))
    assert r2.status_code == 200
    assert len(r2.json()["items"]) == 1
    assert r2.json()["items"][0]["es_nota_interna"] is False


async def test_nota_interna_oculta_a_cliente(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    agente = await seed_usuario(db_session, email="a@test.com", password="Password12345", rol="agente")
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")
    tid = await _crear_ticket(client, tok_c)
    await _asignar_ticket(db_session, tid, agente.id)

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
    assert len(r.json()["items"]) == 1
    assert r.json()["items"][0]["contenido"] == "publico"

    # Agente ve 2
    r2 = await client.get(f"/api/tickets/{tid}/comentarios", headers=auth_header(tok_a))
    assert len(r2.json()["items"]) == 2


async def test_cliente_no_puede_crear_nota_interna_403(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
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
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")

    await client.post(
        "/api/tickets",
        headers=auth_header(await login_token(client, "c1@test.com", "P12345678")),
        json={
            "titulo": "T1",
            "descripcion": "D",
            "categoria_id": 1,
            "subcategoria_id": 1,
            "elemento_afectado": "punto_venta",
            "prioridad": "media",
        },
    )
    await client.post(
        "/api/tickets",
        headers=auth_header(await login_token(client, "c2@test.com", "P12345678")),
        json={
            "titulo": "T2",
            "descripcion": "D",
            "categoria_id": 1,
            "subcategoria_id": 1,
            "elemento_afectado": "punto_venta",
            "prioridad": "media",
        },
    )
    tok_adm = await login_token(client, "adm@test.com", "Password12345")
    r = await client.get("/api/tickets", headers=auth_header(tok_adm))
    assert r.status_code == 200
    assert r.json()["total"] == 2


async def test_mesa_ayuda_puede_crear_nota_interna(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_usuario(db_session, email="m@test.com", password="Password12345", rol="mesa_ayuda")
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")
    tid = await _crear_ticket(client, tok_c)

    r = await client.post(
        f"/api/tickets/{tid}/comentarios",
        headers=auth_header(tok_m),
        json={"contenido": "nota interna de mesa", "es_nota_interna": True},
    )
    assert r.status_code == 201, r.text
    assert r.json()["es_nota_interna"] is True

    r = await client.get(f"/api/tickets/{tid}/comentarios", headers=auth_header(tok_m))
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1

    r = await client.get(f"/api/tickets/{tid}/comentarios", headers=auth_header(tok_c))
    assert r.status_code == 200
    assert len(r.json()["items"]) == 0


async def test_implicados_comentario_publico_incluye_cliente_agente_y_admins(  # type: ignore[no-untyped-def]
    client, db_session
):
    """Un comentario publico debe notificar al cliente, al agente y a los admins."""
    await seed_empresa(db_session, pk=1)
    cliente = await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    agente = await seed_usuario(db_session, email="a@test.com", password="Password12345", rol="agente")
    admin = await seed_usuario(db_session, email="adm@test.com", password="Password12345", rol="administrador")
    admin2 = await seed_usuario(db_session, email="adm2@test.com", password="Password12345", rol="administrador")
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")

    tok_c = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json={
            "titulo": "T",
            "descripcion": "D",
            "categoria_id": 1,
            "subcategoria_id": 1,
            "elemento_afectado": "punto_venta",
            "prioridad": "media",
        },
    )
    tid = r.json()["id"]

    ticket = (await db_session.execute(select(Ticket).where(Ticket.id == tid))).scalar_one()
    ticket.agente_id = agente.id
    await db_session.commit()

    ids = await _resolve_implicated_user_ids(
        ticket, cliente, db_session, es_nota_interna=False
    )

    assert agente.id in ids
    assert admin.id in ids
    assert admin2.id in ids
    assert cliente.id not in ids


async def test_implicados_nota_interna_excluye_cliente(  # type: ignore[no-untyped-def]
    client, db_session
):
    """Una nota interna NUNCA debe incluir al cliente del ticket."""
    await seed_empresa(db_session, pk=1)
    cliente = await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    agente = await seed_usuario(db_session, email="a@test.com", password="Password12345", rol="agente")
    admin = await seed_usuario(db_session, email="adm@test.com", password="Password12345", rol="administrador")
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")

    tok_c = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json={
            "titulo": "T",
            "descripcion": "D",
            "categoria_id": 1,
            "subcategoria_id": 1,
            "elemento_afectado": "punto_venta",
            "prioridad": "media",
        },
    )
    tid = r.json()["id"]

    ticket = (await db_session.execute(select(Ticket).where(Ticket.id == tid))).scalar_one()
    ticket.agente_id = agente.id
    await db_session.commit()

    autor = agente

    ids = await _resolve_implicated_user_ids(
        ticket, autor, db_session, es_nota_interna=True
    )

    assert cliente.id not in ids
    assert agente.id not in ids
    assert admin.id in ids
    assert autor.id not in ids


async def test_implicados_autor_es_cliente_otro_cliente_no_recibe(  # type: ignore[no-untyped-def]
    client, db_session
):
    """Cuando un cliente comenta, OTROS clientes (de otra empresa o sin ticket) no deben recibir."""
    await seed_empresa(db_session, pk=1)
    await seed_empresa(db_session, pk=2)
    cliente_a = await seed_usuario(db_session, email="a@test.com", password="Password12345", rol="cliente", empresa_id=1)
    cliente_b = await seed_usuario(db_session, email="b@test.com", password="Password12345", rol="cliente", empresa_id=2)
    admin = await seed_usuario(db_session, email="adm@test.com", password="Password12345", rol="administrador")
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")

    tok_a = await login_token(client, "a@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_a),
        json={
            "titulo": "T",
            "descripcion": "D",
            "categoria_id": 1,
            "subcategoria_id": 1,
            "elemento_afectado": "punto_venta",
            "prioridad": "media",
        },
    )
    tid = r.json()["id"]

    ticket = (await db_session.execute(select(Ticket).where(Ticket.id == tid))).scalar_one()

    ids = await _resolve_implicated_user_ids(
        ticket, cliente_a, db_session, es_nota_interna=False
    )

    assert cliente_b.id not in ids
    assert admin.id in ids