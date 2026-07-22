"""Tests de metricas: acceso por rol."""
from __future__ import annotations

from tests.helpers import (
    auth_header,
    login_token,
    seed_empresa,
    seed_usuario,
)


async def test_mesa_ayuda_accede_a_metricas_200(client, db_session):  # type: ignore[no-untyped-def]
    await seed_usuario(
        db_session,
        nombre="Mesa",
        email="mesa@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    tok = await login_token(client, "mesa@test.com", "Password12345")

    endpoints = [
        "/api/metricas/tiempos",
        "/api/metricas/volumen",
        "/api/metricas/infraestructura",
        "/api/metricas/rendimiento-agente",
        "/api/metricas/tiempo-por-agente",
        "/api/metricas/reaperturas",
        "/api/metricas/sla",
    ]
    for ep in endpoints:
        r = await client.get(ep, headers=auth_header(tok))
        assert r.status_code == 200, f"{ep} -> {r.status_code} {r.text}"


async def test_cliente_no_accede_a_metricas_403(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.get("/api/metricas/tiempos", headers=auth_header(tok))
    assert r.status_code == 403


async def test_mesa_ayuda_lista_usuarios_solo_lectura(client, db_session):  # type: ignore[no-untyped-def]
    await seed_usuario(
        db_session,
        nombre="Mesa",
        email="mesa@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="agente",
    )
    tok = await login_token(client, "mesa@test.com", "Password12345")

    r = await client.get("/api/usuarios", headers=auth_header(tok))
    assert r.status_code == 200, r.text
    assert r.json()["total"] >= 1

    r = await client.get("/api/usuarios?rol=agente", headers=auth_header(tok))
    assert r.status_code == 200
    assert r.json()["total"] >= 1

    r = await client.delete(
        "/api/usuarios/" + r.json()["items"][0]["id"],
        headers=auth_header(tok),
    )
    assert r.status_code == 403
