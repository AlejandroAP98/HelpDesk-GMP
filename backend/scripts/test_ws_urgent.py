"""Test E2E del flujo de ticket urgente via WebSocket."""
import asyncio
import json
import httpx
import websockets


async def login(email: str, password: str) -> dict:
    async with httpx.AsyncClient(base_url="http://localhost:8000") as c:
        r = await c.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        return r.json()


async def main() -> None:
    agente = await login("agente@helpdesk.com", "Agente12345")
    cliente = await login("juan@empresa.com", "Cliente12345")
    ag_token = agente["access_token"]
    cli_token = cliente["access_token"]

    eventos_agente: list[dict] = []
    eventos_cliente: list[dict] = []

    async def escuchar(token: str, sink: list, label: str) -> None:
        url = f"ws://localhost:8000/ws?token={token}"
        async with websockets.connect(url) as ws:
            while True:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=8.0)
                    ev = json.loads(msg)
                    sink.append(ev)
                    print(f"[{label}] EVENTO: {ev.get('type')} ticket={ev.get('ticket_id','')[:8]}")
                except TimeoutError:
                    print(f"[{label}] timeout (8s sin eventos)")
                    break

    async def crear_ticket_urgente() -> None:
        await asyncio.sleep(1.5)  # esperar que WS conecten
        async with httpx.AsyncClient(base_url="http://localhost:8000") as c:
            r = await c.post(
                "/api/tickets",
                json={
                    "titulo": "WS test urgente",
                    "descripcion": "Probando alerta WS",
                    "categoria_id": 2,
                    "prioridad": "urgente",
                },
                headers={"Authorization": f"Bearer {cli_token}"},
            )
            data = r.json()
            print(f"[crear] ticket creado id={data['id'][:8]} prioridad={data['prioridad']}")

    tasks = [
        escuchar(ag_token, eventos_agente, "AGENTE"),
        escuchar(cli_token, eventos_cliente, "CLIENTE"),
        crear_ticket_urgente(),
    ]
    await asyncio.gather(*tasks, return_exceptions=True)

    print("\n--- RESUMEN ---")
    print(f"Agente recibiio {len(eventos_agente)} evento(s) (esperado 1)")
    print(f"Cliente recibiio {len(eventos_cliente)} evento(s) (esperado 0)")
    if eventos_agente:
        print("CONTENIDO:", json.dumps(eventos_agente[0], indent=2))
    assert len(eventos_agente) == 1, "El agente deberia haber recibido 1 evento"
    assert len(eventos_cliente) == 0, "El cliente NO deberia recibir el evento urgente"
    assert eventos_agente[0]["type"] == "ticket:urgent_created"
    print("OK")


if __name__ == "__main__":
    asyncio.run(main())