"""Seed inicial: 1 empresa demo + 1 admin.

Uso (dentro del contenedor backend):
    python -m scripts.seed [--reset]
"""
import argparse
import asyncio
import sys

from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal
from app.models.empresa import Empresa
from app.models.enums import RolUsuario
from app.models.usuario import Usuario
from app.models.categoria import Categoria
from app.models.subcategoria import Subcategoria
from app.core.security import hash_password


EMPRESA_DEMO = {"id": 1, "nombre": "Empresa Demo S.A."}
ADMIN_DEMO = {
    "nombre": "Admin Inicial",
    "email": "admin@helpdesk.com",
    "password": "Admin123456",
    "rol": RolUsuario.administrador,
    "empresa_id": None,
}
AGENTES_DEMO = [
    {
        "nombre": "Agente Demo 1",
        "email": "agente1@helpdesk.com",
        "password": "Agente123456",
        "rol": RolUsuario.agente,
        "empresa_id": None,
    },
    {
        "nombre": "Agente Demo 2",
        "email": "agente2@helpdesk.com",
        "password": "Agente123456",
        "rol": RolUsuario.agente,
        "empresa_id": None,
    },
]
CLIENTES_DEMO = [
    {
        "nombre": "Cliente Demo 1",
        "email": "cliente1@helpdesk.com",
        "password": "Cliente123456",
        "rol": RolUsuario.cliente,
        "empresa_id": 1,
    },
    {
        "nombre": "Cliente Demo 2",
        "email": "cliente2@helpdesk.com",
        "password": "Cliente123456",
        "rol": RolUsuario.cliente,
        "empresa_id": 1,
    },
]
CATEGORIAS_DEMO = [
    {
        "nombre": "Soporte",
        "descripcion": "Fallls operativas y degradación del servicio",
        "subcategorias": [
            ("Caída total del servicio", "Interrupción completa del servicio de conectividad"),
            ("Lentitud o intermitencia", "Degradación o intermitencia en la conexión"),
        ],
    },
    {
        "nombre": "Instalación",
        "descripcion": "Tareas planificadas, despliegues y altas de servicios",
        "subcategorias": [
            ("Instalación o Cambio de Hardware", "Montaje, reemplazo o migración de equipos de red"),
            ("Cableado estructurado", "Despliegue de red LAN, canalización o peinado de rack"),
            ("Configuración de equipos nuevos", "Comisionamiento y aprovisionamiento de routers/switches"),
        ],
    },
    {
        "nombre": "Mantenimiento",
        "descripcion": "Tareas preventivas destinadas a mitigar riesgos futuros",
        "subcategorias": [
            ("Actualización de Software", "Parcheo de firmware o sistema operativo en equipos de red"),
            ("Limpieza y Respaldo", "Mantenimiento preventivo físico y lógico de infraestructura"),
        ],
    },
]


async def run(reset: bool = False) -> None:
    async with AsyncSessionLocal() as db:
        if reset:
            from sqlalchemy import delete
            emails_to_delete = [ADMIN_DEMO["email"]] + [a["email"] for a in AGENTES_DEMO] + [c["email"] for c in CLIENTES_DEMO]
            await db.execute(delete(Usuario).where(Usuario.email.in_(emails_to_delete)))
            await db.execute(delete(Subcategoria))
            await db.execute(delete(Categoria))
            await db.execute(delete(Empresa).where(Empresa.id == EMPRESA_DEMO["id"]))
            await db.commit()

        nombres_validos = {c["nombre"] for c in CATEGORIAS_DEMO}
        all_cats = (await db.execute(select(Categoria))).scalars().all()
        for cat in all_cats:
            if cat.nombre not in nombres_validos:
                await db.execute(text("DELETE FROM historial_estados WHERE ticket_id IN (SELECT id FROM tickets WHERE categoria_id = :cid)"), {"cid": cat.id})
                await db.execute(text("DELETE FROM adjuntos WHERE ticket_id IN (SELECT id FROM tickets WHERE categoria_id = :cid)"), {"cid": cat.id})
                await db.execute(text("DELETE FROM comentarios WHERE ticket_id IN (SELECT id FROM tickets WHERE categoria_id = :cid)"), {"cid": cat.id})
                await db.execute(text("DELETE FROM tickets WHERE categoria_id = :cid"), {"cid": cat.id})
                await db.execute(text("DELETE FROM subcategorias WHERE categoria_id = :cid"), {"cid": cat.id})
                await db.execute(text("DELETE FROM categorias WHERE id = :cid"), {"cid": cat.id})
                print(f"Categoría obsoleta eliminada: id={cat.id} nombre={cat.nombre!r}")
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

        print(" DEBUG: despues de admin", flush=True)

        for demo_user in AGENTES_DEMO + CLIENTES_DEMO:
            print(f" DEBUG: procesando {demo_user['email']}", flush=True)
            user_db = (await db.execute(select(Usuario).where(Usuario.email == demo_user["email"]))).scalar_one_or_none()
            if user_db is None:
                user_db = Usuario(
                    nombre=demo_user["nombre"],
                    email=demo_user["email"],
                    password_hash=hash_password(demo_user["password"]),
                    rol=demo_user["rol"],
                    empresa_id=demo_user["empresa_id"],
                )
                db.add(user_db)
                await db.commit()
                await db.refresh(user_db)
                print(f"Usuario creado: id={user_db.id} email={user_db.email!r} rol={user_db.rol.value}")
                print(f"  Credenciales: {demo_user['email']} / {demo_user['password']}")
            else:
                print(f"Usuario ya existe: id={user_db.id} email={user_db.email!r}")

        for cat_data in CATEGORIAS_DEMO:
            cat_db = (await db.execute(select(Categoria).where(Categoria.nombre == cat_data["nombre"]))).scalar_one_or_none()
            if cat_db is None:
                cat_db = Categoria(nombre=cat_data["nombre"], descripcion=cat_data["descripcion"])
                db.add(cat_db)
                await db.commit()
                await db.refresh(cat_db)
                print(f"Categoría creada: id={cat_db.id} nombre={cat_db.nombre!r}")
            else:
                print(f"Categoría ya existe: id={cat_db.id} nombre={cat_db.nombre!r}")

            for sub_nombre, sub_desc in cat_data.get("subcategorias", []):
                sub_db = (
                    await db.execute(
                        select(Subcategoria).where(
                            Subcategoria.categoria_id == cat_db.id,
                            Subcategoria.nombre == sub_nombre,
                        )
                    )
                ).scalar_one_or_none()
                if sub_db is None:
                    sub_db = Subcategoria(
                        categoria_id=cat_db.id,
                        nombre=sub_nombre,
                        descripcion=sub_desc,
                    )
                    db.add(sub_db)
                    await db.commit()
                    print(f"  Subcategoría creada: id={sub_db.id} nombre={sub_db.nombre!r}")
                else:
                    print(f"  Subcategoría ya existe: id={sub_db.id} nombre={sub_db.nombre!r}")

        await db.execute(text("SELECT setval('empresas_id_seq', (SELECT COALESCE(MAX(id),1) FROM empresas))"))
        await db.execute(text("SELECT setval('categorias_id_seq', (SELECT COALESCE(MAX(id),1) FROM categorias))"))
        await db.execute(text("SELECT setval('subcategorias_id_seq', (SELECT COALESCE(MAX(id),1) FROM subcategorias))"))
        await db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed inicial HelpDesk-GMP")
    parser.add_argument("--reset", action="store_true", help="Borra empresa+admin demo antes de insertar")
    args = parser.parse_args()
    try:
        asyncio.run(run(reset=args.reset))
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()