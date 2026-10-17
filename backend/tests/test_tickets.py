"""Tests de tickets: maquina de estados, asignacion, multi-tenant, urgente."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

from app.models.punto_venta import PuntoVenta
from tests.helpers import (
    auth_header,
    get_usuario_by_email,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_matriz_prioridad,
    seed_subcategoria,
    seed_usuario,
)


def _ticket_body(categoria_id: int = 1, **overrides) -> dict:
    base = {
        "titulo": "T",
        "descripcion": "D",
        "categoria_id": categoria_id,
        "subcategoria_id": 1,
        "elemento_afectado": "punto_venta",
        "prioridad": "media",
    }
    base.update(overrides)
    return base


async def test_cliente_crea_ticket_urgente(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="Hardware")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="urgente",
    )
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(titulo="Pantalla en blanco", descripcion="No carga nada"),
    )
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["estado"] == "abierto"
    assert t["prioridad"] == "urgente"
    assert t["empresa_id"] == 1


async def test_no_urgente_no_publica_evento(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="Software")
    await seed_subcategoria(db_session, categoria_id=1, nombre="SW")
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(titulo="Bug en login", descripcion="No logea"),
    )
    assert r.status_code == 201
    assert r.json()["prioridad"] == "media"


async def test_cliente_no_admin_asignar_403(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_categoria(db_session, nombre="Redes")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Net")
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(prioridad="baja"),
    )
    assert r.status_code == 201
    tid = r.json()["id"]

    agente = await get_usuario_by_email(db_session, "a@test.com")
    r2 = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok),
        json={"agente_id": str(agente.id)},
    )
    assert r2.status_code == 403


async def test_admin_asigna_transicion_abierto_asignado(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="adm@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_categoria(db_session, nombre="DB")
    await seed_subcategoria(db_session, categoria_id=1, nombre="DB")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_adm = await login_token(client, "adm@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    agente = await get_usuario_by_email(db_session, "a@test.com")
    r2 = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_adm),
        json={"agente_id": str(agente.id)},
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["estado"] == "asignado"
    assert body["agente_id"] == str(agente.id)


async def test_transicion_invalida_409(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="Network")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Net")
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(prioridad="baja"),
    )
    tid = r.json()["id"]

    # Saltar a cerrado sin pasar por asignado/en_progreso/resuelto
    r2 = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok),
        json={"estado": "cerrado"},
    )
    assert r2.status_code == 409


async def test_cliente_no_puede_resolver_403(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="adm@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_categoria(db_session, nombre="Infra")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Inf")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_adm = await login_token(client, "adm@test.com", "Password12345")
    agente = await get_usuario_by_email(db_session, "a@test.com")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    tid = r.json()["id"]
    await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_adm),
        json={"agente_id": str(agente.id)},
    )
    await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_adm),
        json={"estado": "en_progreso"},
    )

    r2 = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_c),
        json={"estado": "resuelto"},
    )
    assert r2.status_code == 403


async def test_flujo_completo_ciclo_vida(client, db_session):  # type: ignore[no-untyped-def]
    """Flujo completo: abierto -> asignado -> en_progreso -> resuelto -> cerrado."""
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="adm@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_categoria(db_session, nombre="Hardware")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")
    tok_adm = await login_token(client, "adm@test.com", "Password12345")
    agente = await get_usuario_by_email(db_session, "a@test.com")

    # abierto
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(titulo="Bug serio", descripcion="No carga", prioridad="alta"),
    )
    tid = r.json()["id"]
    assert r.json()["estado"] == "abierto"

    # asignado (admin)
    r = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_adm),
        json={"agente_id": str(agente.id)},
    )
    assert r.json()["estado"] == "asignado"

    # en_progreso (agente)
    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_a),
        json={"estado": "en_progreso"},
    )
    assert r.json()["estado"] == "en_progreso"

    # resuelto (agente)
    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_a),
        json={"estado": "resuelto"},
    )
    assert r.json()["estado"] == "resuelto"

    # cerrado (cliente)
    r = await client.post(
        f"/api/tickets/{tid}/cerrar",
        headers=auth_header(tok_c),
    )
    assert r.json()["estado"] == "cerrado"


async def test_ticket_cerrado_no_admite_comentarios(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(titulo="Cerrado rapido", prioridad="baja"),
    )
    tid = r.json()["id"]

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        await s.execute(text("UPDATE tickets SET estado='cerrado' WHERE id=:i"), {"i": tid})
        await s.commit()

    # Intentar comentar
    r2 = await client.post(
        f"/api/tickets/{tid}/comentarios",
        headers=auth_header(tok),
        data={"contenido": "hola"},
    )
    assert r2.status_code == 409


async def test_admin_reabre_ticket(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="adm@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_categoria(db_session, nombre="X")
    await seed_subcategoria(db_session, categoria_id=1, nombre="X")
    tok = await login_token(client, "adm@test.com", "Password12345")

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        await s.execute(
            text(
                "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, subcategoria_id, elemento_afectado, titulo, descripcion, estado, prioridad) "
                "VALUES (1, (SELECT id FROM usuarios WHERE email='adm@test.com'), 1, 1, 'punto_venta', 'T', 'D', 'cerrado', 'media')"
            )
        )
        await s.commit()
        r = await s.execute(text("SELECT id FROM tickets WHERE titulo='T'"))
        tid = str(r.scalar())

    r = await client.post(f"/api/tickets/{tid}/reabrir", headers=auth_header(tok))
    assert r.status_code == 200
    assert r.json()["estado"] == "abierto"
    assert r.json()["agente_id"] is None


async def test_multi_tenant_cross_empresa_404(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_empresa(db_session, pk=2, nombre="Other")
    await seed_usuario(
        db_session,
        email="c1@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="c2@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=2,
    )
    await seed_categoria(db_session, nombre="Cat")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Cat")
    tok1 = await login_token(client, "c1@test.com", "Password12345")
    tok2 = await login_token(client, "c2@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok1),
        json=_ticket_body(titulo="Privado emp1", prioridad="baja"),
    )
    tid = r.json()["id"]

    r2 = await client.get(f"/api/tickets/{tid}", headers=auth_header(tok2))
    assert r2.status_code == 404

    r3 = await client.get("/api/tickets", headers=auth_header(tok2))
    assert r3.json()["total"] == 0


async def test_mesa_ayuda_puede_asignar_201(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    agente = await get_usuario_by_email(db_session, "a@test.com")
    r2 = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_m),
        json={"agente_id": str(agente.id)},
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["estado"] == "asignado"
    assert body["agente_id"] == str(agente.id)
    assert body["empresa_nombre"] is not None


async def test_admin_puede_reasignar_ticket_asignado_200(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a1@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="a2@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="admin@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_admin = await login_token(client, "admin@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    agente1 = await get_usuario_by_email(db_session, "a1@test.com")
    r2 = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_admin),
        json={"agente_id": str(agente1.id)},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["estado"] == "asignado"
    assert r2.json()["agente_id"] == str(agente1.id)

    agente2 = await get_usuario_by_email(db_session, "a2@test.com")
    r3 = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_admin),
        json={"agente_id": str(agente2.id)},
    )
    assert r3.status_code == 200, r3.text
    body = r3.json()
    assert body["estado"] == "asignado"
    assert body["agente_id"] == str(agente2.id)


async def test_admin_puede_reasignar_ticket_en_progreso_200(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a1@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="a2@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="admin@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a1 = await login_token(client, "a1@test.com", "Password12345")
    tok_admin = await login_token(client, "admin@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    agente1 = await get_usuario_by_email(db_session, "a1@test.com")
    r2 = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_admin),
        json={"agente_id": str(agente1.id)},
    )
    assert r2.status_code == 200, r2.text

    r3 = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_a1),
        json={"estado": "en_progreso"},
    )
    assert r3.status_code == 200, r3.text
    assert r3.json()["estado"] == "en_progreso"

    agente2 = await get_usuario_by_email(db_session, "a2@test.com")
    r4 = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_admin),
        json={"agente_id": str(agente2.id)},
    )
    assert r4.status_code == 200, r4.text
    body = r4.json()
    assert body["estado"] == "asignado"
    assert body["agente_id"] == str(agente2.id)

    r5 = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_a1),
        json={"estado": "en_progreso"},
    )
    assert r5.status_code == 404

    r6 = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_admin),
        json={"estado": "en_progreso"},
    )
    assert r6.status_code == 200, r6.text
    assert r6.json()["estado"] == "en_progreso"


async def test_mesa_ayuda_no_puede_reabrir_403(client, db_session):  # type: ignore[no-untyped-def]
    from sqlalchemy import text

    from app.core.database import AsyncSessionLocal

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="X")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok = await login_token(client, "m@test.com", "Password12345")

    async with AsyncSessionLocal() as s:
        await s.execute(
            text(
                "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, subcategoria_id, elemento_afectado, titulo, descripcion, estado, prioridad) "
                "VALUES (1, (SELECT id FROM usuarios WHERE email='m@test.com'), 1, 1, 'punto_venta', 'T', 'D', 'cerrado', 'media')"
            )
        )
        await s.commit()
        r = await s.execute(text("SELECT id FROM tickets WHERE titulo='T'"))
        tid = str(r.scalar())

    r = await client.post(f"/api/tickets/{tid}/reabrir", headers=auth_header(tok))
    assert r.status_code == 403


async def test_mesa_ayuda_ve_todos_los_tickets(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Emp1")
    await seed_empresa(db_session, pk=2, nombre="Emp2")
    await seed_usuario(
        db_session,
        email="c1@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="c2@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=2,
    )
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="Cat")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c1 = await login_token(client, "c1@test.com", "Password12345")
    tok_c2 = await login_token(client, "c2@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")

    r1 = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c1),
        json=_ticket_body(titulo="T1", prioridad="baja"),
    )
    assert r1.status_code == 201, r1.text
    r2 = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c2),
        json=_ticket_body(titulo="T2", prioridad="media"),
    )
    assert r2.status_code == 201, r2.text

    r = await client.get("/api/tickets", headers=auth_header(tok_m))
    assert r.status_code == 200
    assert r.json()["total"] == 2


async def test_mesa_ayuda_puede_cerrar_ticket(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")
    agente = await get_usuario_by_email(db_session, "a@test.com")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_m),
        json={"agente_id": str(agente.id)},
    )
    await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_a),
        json={"estado": "en_progreso"},
    )
    await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_a),
        json={"estado": "resuelto"},
    )

    r = await client.post(f"/api/tickets/{tid}/cerrar", headers=auth_header(tok_m))
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "cerrado"


async def test_mesa_ayuda_puede_autoasignarse_201(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")
    mesa = await get_usuario_by_email(db_session, "m@test.com")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    r = await client.post(f"/api/tickets/{tid}/asignarme", headers=auth_header(tok_m))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["estado"] == "asignado"
    assert body["agente_id"] == str(mesa.id)


async def test_admin_puede_autoasignarse_201(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="adm@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_adm = await login_token(client, "adm@test.com", "Password12345")
    admin = await get_usuario_by_email(db_session, "adm@test.com")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    r = await client.post(f"/api/tickets/{tid}/asignarme", headers=auth_header(tok_adm))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["estado"] == "asignado"
    assert body["agente_id"] == str(admin.id)


async def test_cliente_no_puede_autoasignarse_403(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    r = await client.post(f"/api/tickets/{tid}/asignarme", headers=auth_header(tok))
    assert r.status_code == 403


async def test_agente_no_puede_autoasignarse_403(client, db_session):  # type: ignore[no-untyped-def]
    """Agentes NO pueden autoasignarse: solo mesa_ayuda/admin tienen ese permiso."""
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    r = await client.post(f"/api/tickets/{tid}/asignarme", headers=auth_header(tok_a))
    assert r.status_code == 403


async def test_mesa_ayuda_puede_resolver_su_propio_ticket(client, db_session):  # type: ignore[no-untyped-def]
    """Flujo completo: mesa_ayuda se autoasigna, progresa, resuelve y cierra."""
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")
    mesa = await get_usuario_by_email(db_session, "m@test.com")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    r = await client.post(f"/api/tickets/{tid}/asignarme", headers=auth_header(tok_m))
    assert r.status_code == 200
    assert r.json()["agente_id"] == str(mesa.id)

    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_m),
        json={"estado": "en_progreso"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "en_progreso"

    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_m),
        json={"estado": "resuelto"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "resuelto"

    r = await client.post(f"/api/tickets/{tid}/cerrar", headers=auth_header(tok_m))
    assert r.status_code == 200
    assert r.json()["estado"] == "cerrado"


async def test_listar_con_filtro_fechas_no_500(client, db_session):  # type: ignore[no-untyped-def]
    """Regresion: filtros fecha_inicio/fecha_fin deben compararse contra el TIMESTAMP naive
    de Ticket.fecha_creacion. Antes el servicio construia un datetime tz-aware y asyncpg
    lanzaba InvalidDatetimeFormatError -> HTTP 500."""
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(),
    )
    assert r.status_code == 201, r.text

    r = await client.get(
        "/api/tickets",
        params={"fecha_inicio": "2020-01-01", "fecha_fin": "2099-12-31"},
        headers=auth_header(tok_m),
    )
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 1

    r = await client.get(
        "/api/tickets",
        params={"fecha_inicio": "2099-01-01", "fecha_fin": "2099-12-31"},
        headers=auth_header(tok_m),
    )
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 0


async def test_crear_ticket_dispara_email_al_cliente(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    """Al crear un ticket, se debe llamar a send_ticket_created con el email del cliente."""
    from app.services import email_service

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="media",
    )
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    spy = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_ticket_created", spy)
    monkeypatch.setattr(email_service, "send_ticket_urgent", AsyncMock(return_value=True))

    tok = await login_token(client, "cliente@test.com", "Password12345")
    r = await client.post("/api/tickets", headers=auth_header(tok), json=_ticket_body())
    assert r.status_code == 201, r.text

    await asyncio.sleep(0.1)
    assert spy.call_count == 1
    assert spy.call_args.args[1] == "cliente@test.com"


async def test_crear_ticket_urgente_dispara_email_urgente(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    """Al crear un ticket urgente, send_ticket_urgent debe ser llamado."""
    from app.services import email_service

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="urgente",
    )
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    spy_urgent = AsyncMock(return_value=True)
    spy_created = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_ticket_created", spy_created)
    monkeypatch.setattr(email_service, "send_ticket_urgent", spy_urgent)

    tok = await login_token(client, "cliente@test.com", "Password12345")
    r = await client.post("/api/tickets", headers=auth_header(tok), json=_ticket_body())
    assert r.status_code == 201, r.text

    await asyncio.sleep(0.1)
    assert spy_urgent.call_count == 1
    assert spy_created.call_count == 1


async def test_resolver_ticket_dispara_email_resolucion(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    """Al pasar un ticket a `resuelto` se envia email al cliente.

    NO se envia email en `cerrado` porque el cliente tambien puede cerrar y
    ya habria recibido el aviso de resolucion (evita duplicados)."""
    from app.services import email_service

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="mesa@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="media",
    )
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    monkeypatch.setattr(email_service, "send_ticket_created", AsyncMock(return_value=True))
    monkeypatch.setattr(email_service, "send_ticket_urgent", AsyncMock(return_value=True))
    spy_resolved = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_ticket_resolved", spy_resolved)

    tok_c = await login_token(client, "cliente@test.com", "Password12345")
    tok_m = await login_token(client, "mesa@test.com", "Password12345")

    r = await client.post("/api/tickets", headers=auth_header(tok_c), json=_ticket_body())
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    agente = await get_usuario_by_email(db_session, "mesa@test.com")

    r = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_m),
        json={"agente_id": str(agente.id)},
    )
    assert r.status_code == 200
    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_m),
        json={"estado": "en_progreso"},
    )
    assert r.status_code == 200
    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tok_m),
        json={"estado": "resuelto"},
    )
    assert r.status_code == 200, r.text

    await asyncio.sleep(0.1)
    assert spy_resolved.call_count == 1
    assert spy_resolved.call_args.args[1] == "cliente@test.com"


async def test_cerrar_ticket_no_dispara_otro_email(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    """Pasar de `resuelto` a `cerrado` NO debe disparar email: el aviso ya se
    envio al resolver. Esto evita duplicados cuando el cliente confirma cierre."""
    from app.services import email_service

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="mesa@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="media",
    )
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    monkeypatch.setattr(email_service, "send_ticket_created", AsyncMock(return_value=True))
    monkeypatch.setattr(email_service, "send_ticket_urgent", AsyncMock(return_value=True))
    spy_resolved = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_ticket_resolved", spy_resolved)

    tok_c = await login_token(client, "cliente@test.com", "Password12345")
    tok_m = await login_token(client, "mesa@test.com", "Password12345")

    r = await client.post("/api/tickets", headers=auth_header(tok_c), json=_ticket_body())
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    agente = await get_usuario_by_email(db_session, "mesa@test.com")

    r = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tok_m),
        json={"agente_id": str(agente.id)},
    )
    assert r.status_code == 200
    r = await client.patch(
        f"/api/tickets/{tid}/estado", headers=auth_header(tok_m), json={"estado": "en_progreso"}
    )
    assert r.status_code == 200
    r = await client.patch(
        f"/api/tickets/{tid}/estado", headers=auth_header(tok_m), json={"estado": "resuelto"}
    )
    assert r.status_code == 200
    r = await client.post(f"/api/tickets/{tid}/cerrar", headers=auth_header(tok_c))
    assert r.status_code == 200, r.text

    await asyncio.sleep(0.1)
    assert spy_resolved.call_count == 1


async def test_urgente_no_notifica_a_agente(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    """El evento ticket:urgent_created debe publicarse SOLO a mesa_ayuda+administrador.

    Antes los agentes tambien recibian el push, pero como no pueden autoasignarse
    la notificacion era ruido. Este test asegura que la lista de roles para el
    evento urgente excluye explcitamente al rol agente."""
    from app.models.enums import RolUsuario

    captured: dict = {}

    async def _capture(roles, event):  # type: ignore[no-untyped-def]
        captured["roles"] = list(roles)

    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", _capture)

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="urgente",
    )

    monkeypatch.setattr(
        "app.services.email_service.send_ticket_created", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        "app.services.email_service.send_ticket_urgent", AsyncMock(return_value=True)
    )

    tok = await login_token(client, "cliente@test.com", "Password12345")
    r = await client.post("/api/tickets", headers=auth_header(tok), json=_ticket_body())
    assert r.status_code == 201, r.text

    assert "roles" in captured, "publish_to_roles no fue invocado"
    assert RolUsuario.agente.value not in captured["roles"]
    assert RolUsuario.mesa_ayuda.value in captured["roles"]
    assert RolUsuario.administrador.value in captured["roles"]


# ---------------------------------------------------------------------------
# Creacion de tickets por staff (admin/mesa_ayuda) a nombre de un cliente
# ---------------------------------------------------------------------------


async def _seed_staff_scenario(db_session) -> None:  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_empresa(db_session, pk=2, nombre="Otra")
    await seed_usuario(
        db_session,
        email="c1@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="c2@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=2,
    )
    await seed_usuario(
        db_session,
        email="admin@test.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_usuario(
        db_session,
        email="mesa@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="Sub")


def _ticket_admin_body(cliente_id: str, **overrides) -> dict:
    base = {
        "titulo": "T staff",
        "descripcion": "Reportado por telefono",
        "categoria_id": 1,
        "subcategoria_id": 1,
        "elemento_afectado": "punto_venta",
        "empresa_id": 1,
        "cliente_id": cliente_id,
    }
    base.update(overrides)
    return base


async def test_admin_crea_ticket_a_nombre_de_cliente(client, db_session):  # type: ignore[no-untyped-def]
    await _seed_staff_scenario(db_session)
    tok_admin = await login_token(client, "admin@test.com", "Password12345")
    cliente = await get_usuario_by_email(db_session, "c1@test.com")

    r = await client.post(
        "/api/tickets/admin",
        headers=auth_header(tok_admin),
        json=_ticket_admin_body(str(cliente.id)),
    )
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["empresa_id"] == 1
    assert t["cliente_id"] == str(cliente.id)
    assert t["estado"] == "abierto"
    assert t["modificado_por_id"] is not None


async def test_mesa_ayuda_crea_ticket_a_nombre_de_cliente(client, db_session):  # type: ignore[no-untyped-def]
    await _seed_staff_scenario(db_session)
    tok_mesa = await login_token(client, "mesa@test.com", "Password12345")
    cliente = await get_usuario_by_email(db_session, "c1@test.com")

    r = await client.post(
        "/api/tickets/admin",
        headers=auth_header(tok_mesa),
        json=_ticket_admin_body(str(cliente.id)),
    )
    assert r.status_code == 201, r.text
    assert r.json()["cliente_id"] == str(cliente.id)


async def test_cliente_no_puede_usar_endpoint_admin_403(client, db_session):  # type: ignore[no-untyped-def]
    await _seed_staff_scenario(db_session)
    tok_c = await login_token(client, "c1@test.com", "Password12345")
    cliente = await get_usuario_by_email(db_session, "c1@test.com")

    r = await client.post(
        "/api/tickets/admin",
        headers=auth_header(tok_c),
        json=_ticket_admin_body(str(cliente.id)),
    )
    assert r.status_code == 403


async def test_cliente_ajeno_a_empresa_404(client, db_session):  # type: ignore[no-untyped-def]
    """cliente_id de otra empresa -> 404 (no se valida pertenencia)."""
    await _seed_staff_scenario(db_session)
    tok_admin = await login_token(client, "admin@test.com", "Password12345")
    cliente_otra = await get_usuario_by_email(db_session, "c2@test.com")

    r = await client.post(
        "/api/tickets/admin",
        headers=auth_header(tok_admin),
        json=_ticket_admin_body(str(cliente_otra.id), empresa_id=1),
    )
    assert r.status_code == 404


async def test_empresa_inexistente_404(client, db_session):  # type: ignore[no-untyped-def]
    await _seed_staff_scenario(db_session)
    tok_admin = await login_token(client, "admin@test.com", "Password12345")
    cliente = await get_usuario_by_email(db_session, "c1@test.com")

    r = await client.post(
        "/api/tickets/admin",
        headers=auth_header(tok_admin),
        json=_ticket_admin_body(str(cliente.id), empresa_id=999),
    )
    assert r.status_code == 404


async def test_urgente_se_envia_si_notificaciones_email_false(  # type: ignore[no-untyped-def]
    client, db_session, monkeypatch
):
    """Cliente con notificaciones_email=False + ticket urgente: el email urgente
    a mesa/admin se envia igual (alerta operacional desacoplada del toggle del cliente).
    El email de "ticket creado" al cliente NO se envia (respeta el toggle)."""
    from app.services import email_service

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
        notificaciones_email=False,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="urgente",
    )
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    spy_urgent = AsyncMock(return_value=True)
    spy_created = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_ticket_created", spy_created)
    monkeypatch.setattr(email_service, "send_ticket_urgent", spy_urgent)

    tok = await login_token(client, "cliente@test.com", "Password12345")
    r = await client.post("/api/tickets", headers=auth_header(tok), json=_ticket_body())
    assert r.status_code == 201, r.text

    await asyncio.sleep(0.1)
    assert spy_urgent.call_count == 1
    assert spy_created.call_count == 0


async def test_creado_no_se_envia_si_notificaciones_email_false(  # type: ignore[no-untyped-def]
    client, db_session, monkeypatch
):
    """Cliente con notificaciones_email=False + ticket no urgente: NO se envia
    ni el email de creado ni el urgente (regression: el toggle sigue cortando
    el creado; el urgente no aplica porque la prioridad no es urgente)."""
    from app.services import email_service

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
        notificaciones_email=False,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="media",
    )
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    spy_created = AsyncMock(return_value=True)
    spy_urgent = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_ticket_created", spy_created)
    monkeypatch.setattr(email_service, "send_ticket_urgent", spy_urgent)

    tok = await login_token(client, "cliente@test.com", "Password12345")
    r = await client.post("/api/tickets", headers=auth_header(tok), json=_ticket_body())
    assert r.status_code == 201, r.text

    await asyncio.sleep(0.1)
    assert spy_created.call_count == 0
    assert spy_urgent.call_count == 0


async def test_ambos_se_envian_si_notificaciones_email_true(  # type: ignore[no-untyped-def]
    client, db_session, monkeypatch
):
    """Regression: cliente con notificaciones_email=True + ticket urgente
    sigue recibiendo AMBOS emails (creado al cliente + urgente a mesa/admin)."""
    from app.services import email_service

    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cliente@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
        notificaciones_email=True,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="urgente",
    )
    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test_xxx")
    spy_created = AsyncMock(return_value=True)
    spy_urgent = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_ticket_created", spy_created)
    monkeypatch.setattr(email_service, "send_ticket_urgent", spy_urgent)

    tok = await login_token(client, "cliente@test.com", "Password12345")
    r = await client.post("/api/tickets", headers=auth_header(tok), json=_ticket_body())
    assert r.status_code == 201, r.text

    await asyncio.sleep(0.1)
    assert spy_created.call_count == 1
    assert spy_urgent.call_count == 1


async def test_listar_filtra_por_punto_venta_id(client, db_session):  # type: ignore[no-untyped-def]
    """GET /api/tickets?punto_venta_id=N debe devolver solo los tickets cuyo
    FK punto_venta_id coincide. Cobertura del filtro dedicado de PV."""
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="m@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    pv_a = PuntoVenta(empresa_id=1, nombre="PV A", ciudad="Manizales")
    pv_b = PuntoVenta(empresa_id=1, nombre="PV B", ciudad="Manizales")
    db_session.add_all([pv_a, pv_b])
    await db_session.commit()
    await db_session.refresh(pv_a)
    await db_session.refresh(pv_b)

    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_m = await login_token(client, "m@test.com", "Password12345")

    r1 = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(titulo="T A1", punto_venta_id=pv_a.id),
    )
    assert r1.status_code == 201, r1.text
    r2 = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(titulo="T A2", punto_venta_id=pv_a.id),
    )
    assert r2.status_code == 201, r2.text
    r3 = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json=_ticket_body(titulo="T B1", punto_venta_id=pv_b.id),
    )
    assert r3.status_code == 201, r3.text

    r = await client.get(
        "/api/tickets",
        params={"punto_venta_id": pv_a.id},
        headers=auth_header(tok_m),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 2
    titulos = sorted(t["titulo"] for t in body["items"])
    assert titulos == ["T A1", "T A2"]

    r = await client.get(
        "/api/tickets",
        params={"punto_venta_id": pv_b.id},
        headers=auth_header(tok_m),
    )
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["titulo"] == "T B1"


async def test_listar_filtro_punto_venta_respeta_tenant_cliente(client, db_session):  # type: ignore[no-untyped-def]
    """Cliente solo puede filtrar por PVs de su empresa; pasar uno de otra
    empresa no debe devolver tickets de esa empresa (tenant_filter + clear)."""
    await seed_empresa(db_session, pk=1)
    await seed_empresa(db_session, pk=2)
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    pv_propio = PuntoVenta(empresa_id=1, nombre="PV Propio", ciudad="Manizales")
    pv_ajeno = PuntoVenta(empresa_id=2, nombre="PV Ajeno", ciudad="Pereira")
    db_session.add_all([pv_propio, pv_ajeno])
    await db_session.commit()
    await db_session.refresh(pv_propio)
    await db_session.refresh(pv_ajeno)

    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(titulo="T Propio", punto_venta_id=pv_propio.id),
    )
    assert r.status_code == 201, r.text

    r = await client.get(
        "/api/tickets",
        params={"punto_venta_id": pv_ajeno.id},
        headers=auth_header(tok),
    )
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 0