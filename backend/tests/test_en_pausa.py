"""Tests de la feature 'en pausa': permisos, validaciones, acumulacion de tiempo,
descuento del MTTR/SLA, publicacion de eventos y filtro de listado.

Los mocks evitan consumo real de Redis Pub/Sub, push notifications ni emails
(Resend API key forzada a "" por conftest).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

from tests.helpers import (
    auth_header,
    get_usuario_by_email,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_subcategoria,
    seed_usuario,
)


def _ticket_body(**overrides) -> dict:
    base = {
        "titulo": "T",
        "descripcion": "D",
        "categoria_id": 1,
        "subcategoria_id": 1,
        "elemento_afectado": "punto_venta",
        "prioridad": "media",
    }
    base.update(overrides)
    return base


async def _setup_flujo(client, db_session):  # type: ignore[no-untyped-def]
    """Crea empresa + cliente + agente + admin + mesa_ayuda + categoria + subcategoria.
    Devuelve dict con tokens y referencias."""
    await seed_empresa(db_session, pk=1)
    await seed_usuario(
        db_session,
        email="cli@t.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        email="agt@t.com",
        password="Password12345",
        rol="agente",
    )
    await seed_usuario(
        db_session,
        email="adm@t.com",
        password="Password12345",
        rol="administrador",
    )
    await seed_usuario(
        db_session,
        email="mesa@t.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")

    return {
        "tok_cliente": await login_token(client, "cli@t.com", "Password12345"),
        "tok_agente": await login_token(client, "agt@t.com", "Password12345"),
        "tok_admin": await login_token(client, "adm@t.com", "Password12345"),
        "tok_mesa": await login_token(client, "mesa@t.com", "Password12345"),
    }


async def _crear_y_asignar(client, db_session, tokens):  # type: ignore[no-untyped-def]
    """Crea ticket, lo asigna al agente y lo pone en_progreso. Devuelve ticket_id."""
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tokens["tok_cliente"]),
        json=_ticket_body(titulo="Permiso pendiente"),
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    agente = await get_usuario_by_email(db_session, "agt@t.com")
    r = await client.post(
        f"/api/tickets/{tid}/asignar",
        headers=auth_header(tokens["tok_admin"]),
        json={"agente_id": str(agente.id)},
    )
    assert r.status_code == 200, r.text
    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tokens["tok_agente"]),
        json={"estado": "en_progreso"},
    )
    assert r.status_code == 200, r.text
    return tid


async def test_pausar_marca_ticket_y_guarda_motivo(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando permiso de acceso del cliente"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["en_pausa"] is True
    assert body["motivo_pausa"] == "Esperando permiso de acceso del cliente"
    assert body["fecha_pausa"] is not None
    assert body["segundos_pausa_acumulado"] == 0
    assert body["estado"] == "en_progreso"


async def test_pausar_permite_mesa_ayuda(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_mesa"]),
        json={"motivo": "Esperando repuesto del proveedor"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["en_pausa"] is True


async def test_pausar_agente_403(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_agente"]),
        json={"motivo": "Esperando algo"},
    )
    assert r.status_code == 403


async def test_pausar_cliente_403(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_cliente"]),
        json={"motivo": "Esperando algo"},
    )
    assert r.status_code == 403


async def test_pausar_ticket_abierto_409(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tokens["tok_cliente"]),
        json=_ticket_body(),
    )
    tid = r.json()["id"]

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando algo"},
    )
    assert r.status_code == 409


async def test_pausar_ya_pausado_409(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r1 = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando X"},
    )
    assert r1.status_code == 201

    r2 = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando Y"},
    )
    assert r2.status_code == 409


async def test_pausar_motivo_muy_corto_422(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "ab"},
    )
    assert r.status_code == 422


async def test_reanudar_acumula_tiempo_y_limpia_flag(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando repuesto"},
    )
    assert r.status_code == 201

    r = await client.post(
        f"/api/tickets/{tid}/reanudar",
        headers=auth_header(tokens["tok_admin"]),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["en_pausa"] is False
    assert body["motivo_pausa"] is None
    assert body["fecha_pausa"] is None
    assert body["segundos_pausa_acumulado"] >= 0


async def test_reanudar_no_pausado_409(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/reanudar",
        headers=auth_header(tokens["tok_admin"]),
    )
    assert r.status_code == 409


async def test_reanudar_agente_403(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)
    await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando repuesto"},
    )

    r = await client.post(
        f"/api/tickets/{tid}/reanudar",
        headers=auth_header(tokens["tok_agente"]),
    )
    assert r.status_code == 403


async def test_resolver_en_pausa_acumula_tiempo(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    """Cambiar estado a resuelto estando en pausa debe acumular tiempo y limpiar flag."""
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    monkeypatch.setattr(
        "app.services.email_service.send_ticket_resolved", AsyncMock(return_value=True)
    )
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando aprobacion"},
    )
    assert r.status_code == 201

    r = await client.patch(
        f"/api/tickets/{tid}/estado",
        headers=auth_header(tokens["tok_agente"]),
        json={"estado": "resuelto"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["en_pausa"] is False
    assert body["motivo_pausa"] is None
    assert body["estado"] == "resuelto"
    assert body["segundos_pausa_acumulado"] >= 0


async def test_pausar_publica_evento_al_agente(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    captured: dict = {}

    async def _capture_users(user_ids, event):  # type: ignore[no-untyped-def]
        captured["user_ids"] = list(user_ids)
        captured["event"] = event

    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", _capture_users)
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    agente = await get_usuario_by_email(db_session, "agt@t.com")
    r = await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Permiso de acceso"},
    )
    assert r.status_code == 201, r.text

    assert "user_ids" in captured
    assert agente.id in captured["user_ids"]
    assert captured["event"]["type"] == "ticket:paused"
    assert captured["event"]["motivo"] == "Permiso de acceso"


async def test_listar_filtro_en_pausa_true(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid1 = await _crear_y_asignar(client, db_session, tokens)
    tid2 = await _crear_y_asignar(client, db_session, tokens)

    await client.post(
        f"/api/tickets/{tid1}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Permiso"},
    )

    r = await client.get(
        "/api/tickets?en_pausa=true&size=10",
        headers=auth_header(tokens["tok_admin"]),
    )
    assert r.status_code == 200
    ids = {item["id"] for item in r.json()["items"]}
    assert tid1 in ids
    assert tid2 not in ids


async def test_stats_incluye_en_pausa(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)
    await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Permiso"},
    )

    r = await client.get("/api/stats", headers=auth_header(tokens["tok_admin"]))
    assert r.status_code == 200
    body = r.json()
    assert "en_pausa" in body
    assert body["en_pausa"] == 1


async def test_ticket_detalle_expone_campos_pausa(client, db_session, monkeypatch):  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)
    await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Esperando aprobacion gerencial"},
    )

    r = await client.get(
        f"/api/tickets/{tid}",
        headers=auth_header(tokens["tok_cliente"]),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["en_pausa"] is True
    assert body["motivo_pausa"] == "Esperando aprobacion gerencial"
    assert body["fecha_pausa"] is not None
    assert "segundos_pausa_acumulado" in body


async def test_sla_descuenta_tiempo_en_pausa(client, db_session, db_engine, monkeypatch):  # type: ignore[no-untyped-def]
    """Un ticket con 100h totales pero 40h en pausa debe contar 60h para el SLA."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

    monkeypatch.setattr("app.websockets.pubsub.publish_to_roles", AsyncMock())
    monkeypatch.setattr("app.websockets.pubsub.publish_to_users", AsyncMock())
    monkeypatch.setattr(
        "app.services.email_service.send_ticket_resolved", AsyncMock(return_value=True)
    )
    tokens = await _setup_flujo(client, db_session)
    tid = await _crear_y_asignar(client, db_session, tokens)

    await client.post(
        f"/api/tickets/{tid}/pausar",
        headers=auth_header(tokens["tok_admin"]),
        json={"motivo": "Permiso de acceso"},
    )

    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        await s.execute(
            text(
                "UPDATE tickets SET"
                " fecha_primera_respuesta = fecha_creacion + make_interval(mins => 1),"
                " segundos_pausa_acumulado = 40 * 3600,"
                " estado = 'resuelto',"
                " fecha_resolucion = fecha_creacion + make_interval(hours => 100),"
                " motivo_pausa = NULL, fecha_pausa = NULL, en_pausa = false"
                " WHERE id = :tid"
            ),
            {"tid": tid},
        )
        await s.commit()

    r = await client.get(
        "/api/metricas/sla",
        headers=auth_header(tokens["tok_mesa"]),
    )
    assert r.status_code == 200
    data = r.json()
    e1 = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert e1["total_tickets"] == 1
    assert e1["tickets_en_sla"] == 1
    assert abs(e1["mttr_media_horas"] - 60.0) < 0.5
