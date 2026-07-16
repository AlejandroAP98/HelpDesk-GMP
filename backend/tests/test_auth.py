"""Tests de autenticacion, RBAC y multi-tenant."""
from __future__ import annotations

from tests.helpers import (
    auth_header,
    login_token,
    seed_empresa,
    seed_usuario,
)


async def test_register_cliente_publico_ok(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    r = await client.post(
        "/api/auth/register",
        json={
            "nombre": "Juan",
            "email": "juan@test.com",
            "password": "Password12345",
            "empresa_id": 1,
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["usuario"]["rol"] == "cliente"
    assert data["usuario"]["empresa_id"] == 1
    assert "access_token" in data
    assert "refresh_token" in data


async def test_register_duplicado_409(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    body = {
        "nombre": "Juan",
        "email": "dup@test.com",
        "password": "Password12345",
        "empresa_id": 1,
    }
    r1 = await client.post("/api/auth/register", json=body)
    assert r1.status_code == 201
    r2 = await client.post("/api/auth/register", json=body)
    assert r2.status_code == 409


async def test_register_empresa_inexistente_404(client, db_session):  # type: ignore[no-untyped-def]
    r = await client.post(
        "/api/auth/register",
        json={
            "nombre": "Juan",
            "email": "juan@test.com",
            "password": "Password12345",
            "empresa_id": 999,
        },
    )
    assert r.status_code == 404


async def test_login_ok(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Agente",
        email="agente@test.com",
        password="Agente12345",
        rol="agente",
        empresa_id=None,
    )
    r = await client.post(
        "/api/auth/login",
        json={"email": "agente@test.com", "password": "Agente12345"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["usuario"]["email"] == "agente@test.com"
    assert data["usuario"]["rol"] == "agente"


async def test_login_password_incorrecta_401(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Agente12345",
        rol="agente",
    )
    r = await client.post(
        "/api/auth/login",
        json={"email": "a@test.com", "password": "mala"},
    )
    assert r.status_code == 401


async def test_me_sin_token_401(client):  # type: ignore[no-untyped-def]
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_me_con_token_ok(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        email="juan@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    token = await login_token(client, "juan@test.com", "Password12345")
    r = await client.get("/api/auth/me", headers=auth_header(token))
    assert r.status_code == 200
    assert r.json()["email"] == "juan@test.com"


async def test_refresh_ok(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        email="a@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    r_login = await client.post(
        "/api/auth/login",
        json={"email": "a@test.com", "password": "Password12345"},
    )
    rt = r_login.json()["refresh_token"]
    r = await client.post("/api/auth/refresh", json={"refresh_token": rt})
    assert r.status_code == 200
    assert "access_token" in r.json()


async def test_register_agente_por_cliente_403(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    token = await login_token(client, "c@test.com", "Password12345")
    r = await client.post(
        "/api/auth/register/agente",
        headers=auth_header(token),
        json={
            "nombre": "Nuevo Agente",
            "email": "x@test.com",
            "password": "Password12345",
            "rol": "agente",
        },
    )
    assert r.status_code == 403


async def test_register_agente_por_admin_201(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Admin",
        email="admin@test.com",
        password="Password12345",
        rol="administrador",
    )
    token = await login_token(client, "admin@test.com", "Password12345")
    r = await client.post(
        "/api/auth/register/agente",
        headers=auth_header(token),
        json={
            "nombre": "Nuevo Agente",
            "email": "agente@test.com",
            "password": "Password12345",
            "rol": "agente",
        },
    )
    assert r.status_code == 201
    assert r.json()["rol"] == "agente"


async def test_register_cliente_por_admin_201(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Admin",
        email="admin@test.com",
        password="Password12345",
        rol="administrador",
    )
    token = await login_token(client, "admin@test.com", "Password12345")
    r = await client.post(
        "/api/auth/register/agente",
        headers=auth_header(token),
        json={
            "nombre": "Nuevo Cliente",
            "email": "cliente@test.com",
            "password": "Password12345",
            "rol": "cliente",
            "empresa_id": 1,
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["rol"] == "cliente"
    assert data["empresa_id"] == 1


async def test_register_cliente_sin_empresa_409(client, db_session):  # type: ignore[no-untyped-def]
    await seed_usuario(
        db_session,
        nombre="Admin",
        email="admin@test.com",
        password="Password12345",
        rol="administrador",
    )
    token = await login_token(client, "admin@test.com", "Password12345")
    r = await client.post(
        "/api/auth/register/agente",
        headers=auth_header(token),
        json={
            "nombre": "Nuevo Cliente",
            "email": "cliente@test.com",
            "password": "Password12345",
            "rol": "cliente",
        },
    )
    assert r.status_code == 409
    assert "empresa_id" in r.json()["detail"]