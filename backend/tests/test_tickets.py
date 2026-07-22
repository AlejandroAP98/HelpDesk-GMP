"""Tests de tickets: maquina de estados, asignacion, multi-tenant, urgente."""
from __future__ import annotations

from tests.helpers import (
    auth_header,
    get_usuario_by_email,
    login_token,
    seed_categoria,
    seed_empresa,
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
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={
            "titulo": "Pantalla en blanco",
            "descripcion": "No carga nada",
            "categoria_id": 1,
            "prioridad": "urgente",
        },
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
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={
            "titulo": "Bug en login",
            "descripcion": "No logea",
            "categoria_id": 1,
            "prioridad": "media",
        },
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
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={"titulo": "T", "descripcion": "D", "categoria_id": 1, "prioridad": "baja"},
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
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={"titulo": "T", "descripcion": "D", "categoria_id": 1, "prioridad": "baja"},
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
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_adm = await login_token(client, "adm@test.com", "Password12345")
    agente = await get_usuario_by_email(db_session, "a@test.com")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json={"titulo": "T", "descripcion": "D", "categoria_id": 1, "prioridad": "media"},
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
    tok_c = await login_token(client, "c@test.com", "Password12345")
    tok_a = await login_token(client, "a@test.com", "Password12345")
    tok_adm = await login_token(client, "adm@test.com", "Password12345")
    agente = await get_usuario_by_email(db_session, "a@test.com")

    # abierto
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok_c),
        json={"titulo": "Bug serio", "descripcion": "No carga", "categoria_id": 1, "prioridad": "alta"},
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
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={"titulo": "Cerrado rapido", "descripcion": "D", "categoria_id": 1, "prioridad": "baja"},
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
        json={"contenido": "hola"},
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
    tok = await login_token(client, "adm@test.com", "Password12345")

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        await s.execute(
            text(
                "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, titulo, descripcion, estado, prioridad) "
                "VALUES (1, (SELECT id FROM usuarios WHERE email='adm@test.com'), 1, 'T', 'D', 'cerrado', 'media')"
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
    tok1 = await login_token(client, "c1@test.com", "Password12345")
    tok2 = await login_token(client, "c2@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok1),
        json={"titulo": "Privado emp1", "descripcion": "D", "categoria_id": 1, "prioridad": "baja"},
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


async def test_mesa_ayuda_no_puede_reabrir_403(client, db_session):  # type: ignore[no-untyped-def]
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

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