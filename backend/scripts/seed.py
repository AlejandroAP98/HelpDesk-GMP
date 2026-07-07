"""Seed inicial: 1 empresa demo + 1 admin.

Uso (dentro del contenedor backend):
    python -m scripts.seed [--reset]
"""
import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.empresa import Empresa
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.core.security import hash_password


EMPRESA_DEMO = {"id": 1, "nombre": "Empresa Demo S.A."}
ADMIN_DEMO = {
    "nombre": "Admin Inicial",
    "email": "admin@helpdesk.com",
    "password": "Admin123456",
    "rol": RolUsuario.administrador,
    "empresa_id": None,
}


async def run(reset: bool = False) -> None:
    async with AsyncSessionLocal() as db:
        if reset:
            from sqlalchemy import delete
            await db.execute(delete(Usuario).where(Usuario.email == ADMIN_DEMO["email"]))
            await db.execute(delete(Empresa).where(Empresa.id == EMPRESA_DEMO["id"]))
            await db.commit()

        empresa = (await db.execute(select(Empresa).where(Empresa.id == EMPRESA_DEMO["id"]))).scalar_one_or_none()
        if empresa is None:
            empresa = Empresa(id=EMPRESA_DEMO["id"], nombre=EMPRESA_DEMO["nombre"])
            db.add(empresa)
            await db.flush()
            print(f"Empresa creada: id={empresa.id} nombre={empresa.nombre!r}")
        else:
            print(f"Empresa ya existe: id={empresa.id} nombre={empresa.nombre!r}")

        admin = (await db.execute(select(Usuario).where(Usuario.email == ADMIN_DEMO["email"]))).scalar_one_or_none()
        if admin is None:
            admin = Usuario(
                nombre=ADMIN_DEMO["nombre"],
                email=ADMIN_DEMO["email"],
                password_hash=hash_password(ADMIN_DEMO["password"]),
                rol=ADMIN_DEMO["rol"],
                empresa_id=ADMIN_DEMO["empresa_id"],
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
            print(f"Admin creado: id={admin.id} email={admin.email!r}")
            print(f"  Credenciales: {ADMIN_DEMO['email']} / {ADMIN_DEMO['password']}")
        else:
            print(f"Admin ya existe: id={admin.id} email={admin.email!r}")

        from sqlalchemy import text
        await db.execute(text("SELECT setval('empresas_id_seq', (SELECT COALESCE(MAX(id),1) FROM empresas))"))
        await db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed inicial HelpDesk-GMP")
    parser.add_argument("--reset", action="store_true", help="Borra empresa+admin demo antes de insertar")
    args = parser.parse_args()
    asyncio.run(run(reset=args.reset))
    sys.exit(0)


if __name__ == "__main__":
    main()