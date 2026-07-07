"""Helpers para crear datos de test en la DB de test."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from httpx import AsyncClient

from app.core.security import hash_password
from app.models.categoria import Categoria
from app.models.empresa import Empresa
from app.models.enums import RolUsuario
from app.models.usuario import Usuario


async def seed_empresa(db: AsyncSession, nombre: str = "Test Corp", pk: int | None = None) -> Empresa:
    emp = Empresa(id=pk, nombre=nombre) if pk else Empresa(nombre=nombre)
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


async def seed_categoria(db: AsyncSession, nombre: str = "Hardware", descripcion: str | None = "") -> Categoria:
    cat = Categoria(nombre=nombre, descripcion=descripcion)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


async def seed_usuario(
    db: AsyncSession,
    *,
    nombre: str = "Test",
    email: str = "test@example.com",
    password: str = "Password12345",
    rol: RolUsuario = RolUsuario.cliente,
    empresa_id: int | None = None,
) -> Usuario:
    u = Usuario(
        nombre=nombre,
        email=email,
        password_hash=hash_password(password),
        rol=rol,
        empresa_id=empresa_id,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def login_token(client: AsyncClient, email: str, password: str) -> str:
    """Loguea y devuelve solo el access_token."""
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def get_usuario_by_email(db: AsyncSession, email: str) -> Usuario:
    return (
        await db.execute(select(Usuario).where(Usuario.email == email))
    ).scalar_one()