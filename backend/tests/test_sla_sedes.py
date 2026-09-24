"""Tests de SLA por sede: umbral 48h para puntos de venta en ciudades remotas."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

import pytest

from app.models.punto_venta import PuntoVenta
from tests.helpers import (
    auth_header,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_matriz_prioridad,
    seed_subcategoria,
    seed_usuario,
)


def _ticket_body(categoria_id: int = 1, **overrides) -> dict:
    base = {
        "titulo": "T",
        "descripcion": "D",
        "categoria_id": categoria_id,
        "subcategoria_id": 1,
        "elemento_afectado": "punto_venta",
        "prioridad": "media",
    }
    base.update(overrides)
    return base


async def _seed_escenario(db_session) -> None:  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Susuerte")
    await seed_empresa(db_session, pk=2, nombre="Otra")
    await seed_usuario(
        db_session,
        email="c@test.com",
        password="Password12345",
        rol="cliente",
        empresa_id=1,
    )
    await seed_usuario(
        db_session,
        nombre="Mesa",
        email="mesa@test.com",
        password="Password12345",
        rol="mesa_ayuda",
    )
    await seed_categoria(db_session, nombre="Hardware")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")
    await seed_matriz_prioridad(
        db_session,
        categoria_id=1,
        subcategoria_id=1,
        elemento="punto_venta",
        prioridad="media",
    )
    pv_manizales = PuntoVenta(empresa_id=1, nombre="PV Centro", ciudad="Manizales")
    pv_remota = PuntoVenta(empresa_id=1, nombre="PV Riosucio", ciudad="Riosucio")
    pv_otra_empresa = PuntoVenta(empresa_id=2, nombre="PV Ajeno", ciudad="Pereira")
    db_session.add_all([pv_manizales, pv_remota, pv_otra_empresa])
    await db_session.commit()
    await db_session.refresh(pv_manizales)
    await db_session.refresh(pv_remota)
    await db_session.refresh(pv_otra_empresa)


async def _marcar_resuelto(
    engine: AsyncEngine, titulo: str, frt_min: int, resolucion_horas: float
) -> None:
    """Marca un ticket como respondido y resuelto con offsets relativos a su creacion."""
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        await s.execute(
            text(
                "UPDATE tickets SET"
                " fecha_primera_respuesta = fecha_creacion + make_interval(mins => :frt),"
                " fecha_resolucion = fecha_creacion + make_interval(hours => :hrs),"
                " estado = 'resuelto'"
                " WHERE titulo = :t"
            ),
            {"frt": frt_min, "hrs": resolucion_horas, "t": titulo},
        )
        await s.commit()


async def _crear_ticket(client, tok: str, **overrides) -> dict:  # type: ignore[no-untyped-def]
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(**overrides),
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_crear_ticket_guarda_punto_venta_y_deriva_nombre(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    assert r.status_code == 200, r.text
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}
    pv_remota_id = pvs["PV Riosucio"]

    t = await _crear_ticket(client, tok, punto_venta_id=pv_remota_id)
    assert t["punto_venta_id"] == pv_remota_id
    assert t["nombre_punto"] == "PV Riosucio"


async def test_punto_venta_de_otra_empresa_409(client, db_session):  # type: ignore[no-untyped-def]
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    from sqlalchemy import select

    pv_ajeno = (
        await db_session.execute(select(PuntoVenta).where(PuntoVenta.nombre == "PV Ajeno"))
    ).scalar_one()

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(punto_venta_id=pv_ajeno.id),
    )
    assert r.status_code == 409, r.text


async def test_sla_sede_remota_48h_sede_local_24h(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """PV en Manizales con 30h -> EN SLA (24h). PV remota con 30h -> EN SLA (48h)."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    t_local = await _crear_ticket(client, tok, titulo="Local OK", punto_venta_id=pvs["PV Centro"])
    t_remota = await _crear_ticket(
        client, tok, titulo="Remota OK", punto_venta_id=pvs["PV Riosucio"]
    )
    assert t_local["punto_venta_id"] and t_remota["punto_venta_id"]

    await _marcar_resuelto(db_engine, "Local OK", frt_min=5, resolucion_horas=20)
    await _marcar_resuelto(db_engine, "Remota OK", frt_min=5, resolucion_horas=30)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["sla_objetivo_mttr_horas"] == 24.0
    assert data["sla_objetivo_mttr_remoto_horas"] == 48.0

    por_empresa = {e["empresa_id"]: e for e in data["por_empresa"]}
    susuerte = por_empresa[1]
    assert susuerte["tickets_en_sla"] == 2
    assert susuerte["mttr_base_horas"] is not None
    assert round(susuerte["mttr_base_horas"], 1) == 20.0
    assert round(susuerte["mttr_remoto_horas"], 1) == 30.0


async def test_sla_sede_remota_36h_fuera_sla_y_local_dentro(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """PV remota con 36h excede 24h pero cumple 48h: el % SLA global cuenta con el umbral propio."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    await _crear_ticket(client, tok, titulo="Remota 36h", punto_venta_id=pvs["PV Riosucio"])
    await _marcar_resuelto(db_engine, "Remota 36h", frt_min=5, resolucion_horas=36)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    data = r.json()
    susuerte = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert susuerte["total_tickets"] == 1
    assert susuerte["tickets_en_sla"] == 1


async def test_sla_sede_local_36h_fuera_sla(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """PV en Manizales con 36h excede el umbral de 24h -> fuera de SLA."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    await _crear_ticket(client, tok, titulo="Local 36h", punto_venta_id=pvs["PV Centro"])
    await _marcar_resuelto(db_engine, "Local 36h", frt_min=5, resolucion_horas=36)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    data = r.json()
    susuerte = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert susuerte["total_tickets"] == 1
    assert susuerte["tickets_en_sla"] == 0


async def test_sla_torre_celda_sin_importar_ciudad(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Torre/Celda usan el umbral de 4h sin importar la ciudad; nunca caen en los
    grupos de punto de venta (base/remoto)."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    await _crear_ticket(
        client, tok, titulo="Torre 2h", elemento_afectado="torre", punto_venta_id=None
    )
    await _marcar_resuelto(db_engine, "Torre 2h", frt_min=5, resolucion_horas=2)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    data = r.json()
    assert data["sla_objetivo_mttr_torre_celda_horas"] == 4.0
    susuerte = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert susuerte["tickets_en_sla"] == 1
    assert susuerte["mttr_torre_horas"] is not None
    assert round(susuerte["mttr_torre_horas"], 1) == 2.0
    assert susuerte["mttr_base_horas"] is None
    assert susuerte["mttr_remoto_horas"] is None


async def test_sla_torre_5h_fuera_de_sla(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Torre con 5h excede el umbral de 4h -> fuera de SLA (aunque exista sede remota)."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    await _crear_ticket(
        client, tok, titulo="Torre 5h", elemento_afectado="torre", punto_venta_id=None
    )
    await _marcar_resuelto(db_engine, "Torre 5h", frt_min=5, resolucion_horas=5)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    data = r.json()
    susuerte = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert susuerte["total_tickets"] == 1
    assert susuerte["tickets_en_sla"] == 0
    assert round(susuerte["mttr_torre_horas"], 1) == 5.0


async def test_sla_celda_2h_en_sla(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Celda con 2h de resolucion cumple el umbral de 4h."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    await _crear_ticket(
        client, tok, titulo="Celda 2h", elemento_afectado="celda", punto_venta_id=None
    )
    await _marcar_resuelto(db_engine, "Celda 2h", frt_min=5, resolucion_horas=2)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    data = r.json()
    susuerte = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert susuerte["tickets_en_sla"] == 1
    assert round(susuerte["mttr_torre_horas"], 1) == 2.0


async def test_sla_torre_con_baja_y_torre_ok(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Torre 5h (fuera 4h) + torre 2h (en SLA): 1 de 2 en SLA."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    await _crear_ticket(
        client, tok, titulo="Torre B 5h", elemento_afectado="torre", punto_venta_id=None
    )
    await _crear_ticket(
        client, tok, titulo="Torre A 2h", elemento_afectado="torre", punto_venta_id=None
    )
    await _marcar_resuelto(db_engine, "Torre B 5h", frt_min=5, resolucion_horas=5)
    await _marcar_resuelto(db_engine, "Torre A 2h", frt_min=5, resolucion_horas=2)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    data = r.json()
    susuerte = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert susuerte["total_tickets"] == 2
    assert susuerte["tickets_en_sla"] == 1
    assert round(susuerte["mttr_torre_horas"], 1) == 3.5


@pytest.mark.parametrize(
    "ciudad, resolucion_horas",
    [
        ("Chinchiná", 20),
        ("chinchina", 20),
        ("Neira", 20),
        ("Palestina", 20),
        ("Anserma", 20),
        ("Belalcázar", 20),
        ("Viterbo", 20),
        ("San Jose", 20),
        ("San José", 30),
    ],
)
async def test_sla_municipios_base_24h(client, db_session, db_engine, ciudad, resolucion_horas):  # type: ignore[no-untyped-def]
    """Los municipios base (Manizales, Villamaría + los 7 adicionales) usan umbral 24h:
    con 20h estan EN SLA y con 30h FUERA (prueba que no miden con 48h)."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    pv = PuntoVenta(empresa_id=1, nombre=f"PV {ciudad}", ciudad=ciudad)
    db_session.add(pv)
    await db_session.commit()
    await db_session.refresh(pv)

    await _crear_ticket(client, tok, titulo=f"T {ciudad} {resolucion_horas}h", punto_venta_id=pv.id)
    await _marcar_resuelto(
        db_engine, f"T {ciudad} {resolucion_horas}h", frt_min=5, resolucion_horas=resolucion_horas
    )

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    data = r.json()
    susuerte = next(e for e in data["por_empresa"] if e["empresa_id"] == 1)
    assert susuerte["total_tickets"] == 1
    en_sla = susuerte["tickets_en_sla"] == 1
    if resolucion_horas <= 24:
        assert en_sla, f"{ciudad} con {resolucion_horas}h debe ENTRAR en SLA (umbral 24h)"
    else:
        assert not en_sla, f"{ciudad} con {resolucion_horas}h debe estar FUERA de SLA (umbral 24h)"
    assert round(susuerte["mttr_base_horas"], 1) == float(resolucion_horas)
    assert susuerte["mttr_remoto_horas"] is None
