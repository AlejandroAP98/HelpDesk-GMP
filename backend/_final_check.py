import asyncio
import csv
import io
from app.services.auth_service import _issue_tokens
from app.core.database import AsyncSessionLocal
from app.models.usuario import Usuario as UsuarioModel
from app.models.enums import RolUsuario
from sqlalchemy import select


async def main():
    async with AsyncSessionLocal() as s:
        u = (await s.execute(select(UsuarioModel).where(UsuarioModel.rol == RolUsuario.mesa_ayuda))).scalars().first()
        tok = (await _issue_tokens(u)).access_token
        import httpx
        async with httpx.AsyncClient(base_url="http://localhost:8000") as c:
            r = await c.get("/api/reportes/tickets/csv", headers={"Authorization": f"Bearer {tok}"})
            text = r.text
            # Escribir el archivo tal cual
            with open("/tmp/csv_dump.csv", "wb") as f:
                f.write(r.content)
            # tambien un dump byte
            print(f"Total bytes: {len(r.content)}")
            print(f"Total chars: {len(text)}")
            # verificar que cada columna esté alineada usando el parser csv
            reader = csv.reader(io.StringIO(text.lstrip("\ufeff")))
            rows = list(reader)
            header = rows[0]
            print(f"Header columns: {len(header)}")
            for i, row in enumerate(rows[1:], 1):
                if len(row) != len(header):
                    print(f"  Row {i}: {len(row)} cols")


asyncio.run(main())