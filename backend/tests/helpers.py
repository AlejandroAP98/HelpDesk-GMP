"""Helpers para crear datos de test en la DB de test."""
from __future__ import annotations


from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from httpx import AsyncClient

from app.core.security import hash_password
from app.models.categoria import Categoria
from app.models.empresa import Empresa
from app.models.enums import PrioridadTicket, RolUsuario
from app.models.matriz_prioridad import MatrizPrioridad
from app.models.subcategoria import Subcategoria
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


async def seed_subcategoria(
    db: AsyncSession,
    categoria_id: int,
    nombre: str = "Subcategoria",
    descripcion: str | None = "",
) -> Subcategoria:
    sub = Subcategoria(
        categoria_id=categoria_id, nombre=nombre, descripcion=descripcion
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


async def seed_usuario(
    db: AsyncSession,
    *,
    nombre: str = "Test",
    email: str = "test@example.com",
    password: str = "Password12345",
    rol: RolUsuario = RolUsuario.cliente,
    empresa_id: int | None = None,
    notificaciones_email: bool = True,
) -> Usuario:
    u = Usuario(
        nombre=nombre,
        email=email,
        password_hash=hash_password(password),
        rol=rol,
        empresa_id=empresa_id,
        notificaciones_email=notificaciones_email,
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


async def seed_matriz_prioridad(
    db: AsyncSession,
    *,
    categoria_id: int,
    subcategoria_id: int,
    elemento: str,
    prioridad: PrioridadTicket | str,
) -> MatrizPrioridad:
    """Inserta una entrada en matriz_prioridad. Crea un mapeo explicito para que
    `calcular_prioridad()` retorne la prioridad solicitada en lugar del fallback 'media'."""
    if isinstance(prioridad, PrioridadTicket):
        prioridad = prioridad.value
    m = MatrizPrioridad(
        categoria_id=categoria_id,
        subcategoria_id=subcategoria_id,
        elemento=elemento,
        prioridad=prioridad,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m