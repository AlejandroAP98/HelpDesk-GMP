"""Test E2E del flujo de ticket urgente via WebSocket (protocolo post-handshake)."""
import asyncio
import json
import httpx
import websockets


async def login(email: str, password: str) -> dict:
    async with httpx.AsyncClient(base_url="http://localhost:8000") as c:
        r = await c.post("/api/auth/login", json={"email": email, "password": password})
        return r.json()


async def registrar_cliente_test() -> dict:
    """Registra un cliente temporal en la empresa demo 1 (idempotente por email)."""
    import uuid as _uuid

    email = f"wstest-{_uuid.uuid4().hex[:8]}@empresa.com"
    async with httpx.AsyncClient(base_url="http://localhost:8000") as c:
        r = await c.post(
            "/api/auth/register",
            json={
                "nombre": "WS Test Cliente",
                "email": email,
                "password": "Cliente123456",
                "empresa_id": 1,
            },
        )
        assert r.status_code == 201, f"registro fallo: {r.status_code} {r.text}"
        return r.json()


async def main() -> None:
    admin = await login("admin@helpdesk.com", "Admin123456")
    cliente = await registrar_cliente_test()
    ag_token = admin["access_token"]
    cli_token = cliente["access_token"]

    eventos_agente: list[dict] = []
    eventos_cliente: list[dict] = []

    async def escuchar(token: str, sink: list, label: str) -> None:
        async with websockets.connect("ws://localhost:8000/ws") as ws:
            await ws.send(json.dumps({"type": "auth", "token": token}))
            ack = json.loads(await ws.recv())
            assert ack.get("type") == "auth_ok", f"auth fallida: {ack}"
            while True:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=8.0)
                    ev = json.loads(msg)
                    sink.append(ev)
                    print(
                        f"[{label}] EVENTO: {ev.get('type')} ticket={ev.get('ticket_id', '')[:8]}"
                    )
                except TimeoutError:
                    print(f"[{label}] timeout (8s sin eventos)")
                    break

    async def crear_ticket_urgente() -> None:
        await asyncio.sleep(1.5)  # esperar que WS conecten
        async with httpx.AsyncClient(base_url="http://localhost:8000") as c:
            r_cat = await c.get(
                "/api/categorias", headers={"Authorization": f"Bearer {cli_token}"}
            )
            cat_id = r_cat.json()["items"][0]["id"]
            r_sub = await c.get(
                f"/api/subcategorias/por-categoria/{cat_id}",
                headers={"Authorization": f"Bearer {cli_token}"},
            )
            sub_id = r_sub.json()["items"][0]["id"]
            r = await c.post(
                "/api/tickets",
                json={
                    "titulo": "WS test urgente",
                    "descripcion": "Probando alerta WS",
                    "categoria_id": cat_id,
                    "subcategoria_id": sub_id,
                    "elemento_afectado": "celda",
                    "prioridad": "urgente",
                },
                headers={"Authorization": f"Bearer {cli_token}"},
            )
            data = r.json()
            print(f"[crear] {r.status_code} {json.dumps(data)[:400]}")

    tasks = [
        escuchar(ag_token, eventos_agente, "ADMIN"),
        escuchar(cli_token, eventos_cliente, "CLIENTE"),
        crear_ticket_urgente(),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r_ in results:
        if isinstance(r_, BaseException):
            print("TASK ERROR:", type(r_).__name__, str(r_)[:300])

    print("\n--- RESUMEN ---")
    print(f"Admin recibio {len(eventos_agente)} evento(s)")
    print(f"Cliente recibio {len(eventos_cliente)} evento(s)")
    urgentes = [e for e in eventos_agente if e.get("type") == "ticket:urgent_created"]
    assert urgentes, "El admin deberia haber recibido el evento urgente"
    assert len(eventos_cliente) == 1 and eventos_cliente[0]["type"] == "ticket:created", (
        "El cliente solo deberia recibir ticket:created, no el evento urgente"
    )
    print("OK")


if __name__ == "__main__":
    asyncio.run(main())
