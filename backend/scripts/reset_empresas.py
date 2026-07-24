"""Reemplaza empresas dummy por las reales de Supabase.

Uso (dentro del contenedor backend):
    python -m scripts.reset_empresas
"""
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def run():
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM historial_estados"))
        await db.execute(text("DELETE FROM adjuntos"))
        await db.execute(text("DELETE FROM comentarios"))
        await db.execute(text("DELETE FROM tickets"))
        await db.execute(text("DELETE FROM puntos_venta"))
        await db.execute(text("DELETE FROM tareas_pendientes"))
        await db.execute(text("DELETE FROM push_subscriptions"))
        await db.execute(text("DELETE FROM usuarios WHERE empresa_id IS NOT NULL"))
        await db.execute(text("DELETE FROM empresas"))
        print("Todo limpio")

        await db.execute(text("INSERT INTO empresas (id, nombre) VALUES (1, 'Susuerte SA')"))
        await db.execute(text("INSERT INTO empresas (id, nombre) VALUES (2, 'Apostar SA')"))
        await db.execute(text("INSERT INTO empresas (id, nombre) VALUES (4, 'Facilisimo')"))
        await db.execute(text("SELECT setval('empresas_id_seq', (SELECT COALESCE(MAX(id),1) FROM empresas))"))
        await db.commit()

        result = await db.execute(text("SELECT id, nombre FROM empresas ORDER BY id"))
        for row in result.fetchall():
            print(f"  id={row[0]}  nombre={row[1]}")
        print("Empresas reales creadas")


if __name__ == "__main__":
    asyncio.run(run())
