"""Sincroniza sedes desde Supabase (GMP) a la tabla puntos_venta del HelpDesk.

Uso (dentro del contenedor backend):
    python -m scripts.sync_sedes_supabase [--dry-run]

Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env del HelpDesk.
"""

import argparse
import asyncio
import sys

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.empresa import Empresa
from app.models.punto_venta import PuntoVenta

SUPABASE_REST = f"{settings.supabase_url}/rest/v1"
HEADERS = {
    "apikey": settings.supabase_service_role_key,
    "Authorization": f"Bearer {settings.supabase_service_role_key}",
}


async def fetch_sedes() -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_REST}/sedes",
            headers=HEADERS,
            params={"select": "id,empresa_id,nombre,direccion,ciudad", "order": "nombre"},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()


async def run(dry_run: bool = False) -> None:
    sedes_remote = await fetch_sedes()
    print(f"Sedes obtenidas de Supabase: {len(sedes_remote)}")

    async with AsyncSessionLocal() as db:
        pv_existentes = {
            (pv.empresa_id, pv.nombre): pv
            for pv in (await db.execute(select(PuntoVenta))).scalars().all()
        }
        empresas_ids = {
            e.id for e in (await db.execute(select(Empresa))).scalars().all()
        }

        creados = 0
        actualizados = 0
        omitidos = 0

        for sede in sedes_remote:
            empresa_id = sede["empresa_id"]
            nombre = sede["nombre"]
            key = (empresa_id, nombre)

            if empresa_id not in empresas_ids:
                print(f"  Saltando '{nombre}': empresa_id={empresa_id} no existe en HelpDesk")
                omitidos += 1
                continue

            pv = pv_existentes.get(key)
            if pv is not None:
                changes = False
                if pv.direccion != sede.get("direccion"):
                    pv.direccion = sede.get("direccion")
                    changes = True
                if pv.ciudad != sede.get("ciudad"):
                    pv.ciudad = sede.get("ciudad")
                    changes = True
                if not pv.activo:
                    pv.activo = True
                    changes = True
                if changes:
                    actualizados += 1
                    if not dry_run:
                        await db.commit()
                    print(f"  Actualizado: '{nombre}' (empresa {empresa_id})")
                else:
                    omitidos += 1
            else:
                pv = PuntoVenta(
                    empresa_id=empresa_id,
                    nombre=nombre,
                    direccion=sede.get("direccion"),
                    ciudad=sede.get("ciudad"),
                    activo=True,
                )
                db.add(pv)
                creados += 1
                if not dry_run:
                    await db.commit()
                print(f"  Creado: '{nombre}' (empresa {empresa_id})")

        if dry_run:
            print(f"\n[DRY RUN] Creados: {creados} | Actualizados: {actualizados} | Omitidos: {omitidos}")
        else:
            print(f"\nSincronizacion completada: {creados} creados, {actualizados} actualizados, {omitidos} omitidos")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sincronizar sedes de Supabase a HelpDesk")
    parser.add_argument("--dry-run", action="store_true", help="Solo mostrar cambios sin aplicar")
    args = parser.parse_args()
    try:
        asyncio.run(run(dry_run=args.dry_run))
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
