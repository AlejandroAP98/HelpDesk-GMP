"""Tests de inactivacion de usuarios (activo) y bloqueo de sesiones."""
from __future__ import annotations

from sqlalchemy import select

from tests.helpers import (
    auth_header,
    get_usuario_by_email,
    seed_empresa,
    seed_usuario,
)


async def test_login_usuario_inactivo_401(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    u = await seed_usuario(
        db_session,
        nombre="Cliente",
        email="inactivo@test.com",
        rol="cliente",
        empresa_id=1,
    )
    u.activo = False
    await db_session.commit()
    r = await client.post(
        "/api/auth/login",
        json={"email": "inactivo@test.com", "password": "Password12345"},
    )
    assert r.status_code == 401, r.text
    assert "inactivo" in r.json()["detail"].lower()


async def test_refresh_usuario_inactivo_401(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Cliente",
        email="refresh@test.com",
        rol="cliente",
        empresa_id=1,
    )
    r_login = await client.post(
        "/api/auth/login",
        json={"email": "refresh@test.com", "password": "Password12345"},
    )
    assert r_login.status_code == 200
    rt = r_login.json()["refresh_token"]

    usuario = await get_usuario_by_email(db_session, "refresh@test.com")
    usuario.activo = False
    await db_session.commit()

    r = await client.post("/api/auth/refresh", json={"refresh_token": rt})
    assert r.status_code == 401, r.text
    assert "inactivo" in r.json()["detail"].lower()


async def test_sesion_activa_se_bloquea_al_inactivar(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Cliente",
        email="sesion@test.com",
        rol="cliente",
        empresa_id=1,
    )
    r_login = await client.post(
        "/api/auth/login",
        json={"email": "sesion@test.com", "password": "Password12345"},
    )
    token = r_login.json()["access_token"]

    r_me = await client.get("/api/auth/me", headers=auth_header(token))
    assert r_me.status_code == 200

    usuario = await get_usuario_by_email(db_session, "sesion@test.com")
    usuario.activo = False
    await db_session.commit()

    r_me2 = await client.get("/api/auth/me", headers=auth_header(token))
    assert r_me2.status_code == 401, r_me2.text


async def test_admin_no_puede_inactivarse_a_si_mismo(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Admin",
        email="admin@test.com",
        rol="administrador",
    )
    token = await client.post(
        "/api/auth/login",
        json={"email": "admin@test.com", "password": "Password12345"},
    )
    access = token.json()["access_token"]
    r_me = await client.get("/api/auth/me", headers=auth_header(access))
    uid = r_me.json()["id"]

    r = await client.patch(
        f"/api/usuarios/{uid}",
        json={"activo": False},
        headers=auth_header(access),
    )
    assert r.status_code == 409, r.text


async def test_inactivar_y_reactivar_usuario(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Admin",
        email="admin2@test.com",
        rol="administrador",
    )
    await seed_usuario(
        db_session,
        nombre="Cliente",
        email="cambio@test.com",
        rol="cliente",
        empresa_id=1,
    )
    token = await client.post(
        "/api/auth/login",
        json={"email": "admin2@test.com", "password": "Password12345"},
    )
    access = token.json()["access_token"]

    r_me = await client.get("/api/auth/me", headers=auth_header(access))
    admin_id = r_me.json()["id"]

    from app.models.usuario import Usuario

    target = (
        await db_session.execute(select(Usuario).where(Usuario.email == "cambio@test.com"))
    ).scalar_one()

    r = await client.patch(
        f"/api/usuarios/{target.id}",
        json={"activo": False},
        headers=auth_header(access),
    )
    assert r.status_code == 200, r.text
    assert r.json()["activo"] is False

    r_login = await client.post(
        "/api/auth/login",
        json={"email": "cambio@test.com", "password": "Password12345"},
    )
    assert r_login.status_code == 401

    r2 = await client.patch(
        f"/api/usuarios/{target.id}",
        json={"activo": True},
        headers=auth_header(access),
    )
    assert r2.status_code == 200, r.text
    assert r2.json()["activo"] is True

    r3 = await client.get(f"/api/usuarios/{admin_id}", headers=auth_header(access))
    assert r3.status_code == 200
    assert r3.json()["activo"] is True


async def test_listar_filtro_activo(client, db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Demo")
    await seed_usuario(
        db_session,
        nombre="Admin",
        email="admin3@test.com",
        rol="administrador",
    )
    u = await seed_usuario(
        db_session,
        nombre="Cliente",
        email="filtro@test.com",
        rol="cliente",
        empresa_id=1,
    )
    u.activo = False
    await db_session.commit()

    token = await client.post(
        "/api/auth/login",
        json={"email": "admin3@test.com", "password": "Password12345"},
    )
    access = token.json()["access_token"]

    r_all = await client.get("/api/usuarios", headers=auth_header(access))
    emails_all = [x["email"] for x in r_all.json()["items"]]
    assert "filtro@test.com" in emails_all

    r_active = await client.get(
        "/api/usuarios", params={"activo": True}, headers=auth_header(access)
    )
    emails_active = [x["email"] for x in r_active.json()["items"]]
    assert "filtro@test.com" not in emails_active
    assert "admin3@test.com" in emails_active

    r_inactive = await client.get(
        "/api/usuarios", params={"activo": False}, headers=auth_header(access)
    )
    emails_inactive = [x["email"] for x in r_inactive.json()["items"]]
    assert "filtro@test.com" in emails_inactive
    assert "admin3@test.com" not in emails_inactive
