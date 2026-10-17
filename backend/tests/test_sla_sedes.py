"""Tests de SLA: umbrales por prioridad (media 96h / baja 144h) y matriz por
elemento/ciudad para urgente-alta (torre-celda 4h, P.Vta 24h, P.Vta remoto 48h).
Ningún test consume la cuota de Resend: conftest fuerza RESEND_API_KEY=""."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

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
    """Marca un ticket como respondido y resuelto con offsets relativos a su creacion.

    Fija `fecha_creacion` a las 14:00:00 UTC (= 09:00 Bogota) del dia de la
    corrida para que el ticket nazca dentro del horario laboral (7-21h).
    Con la regla actual del SLA ("si nacio en horario, el reloj corre continuo"),
    el delta es igual al reloj de pared independientemente de si la resolucion
    cae de noche. Esto hace los tests independientes del horario en que se ejecuten.
    """
    Session = async_sessionmaker(engine, expire_on_commit=False)
    base = datetime.combine(date.today(), time(14, 0, 0))
    primera_respuesta = base + timedelta(minutes=frt_min)
    resolucion = base + timedelta(hours=resolucion_horas)
    async with Session() as s:
        await s.execute(
            text(
                "UPDATE tickets SET"
                " fecha_creacion = :base,"
                " fecha_actualizacion = :base,"
                " fecha_primera_respuesta = :primera,"
                " fecha_resolucion = :resol,"
                " estado = 'resuelto'"
                " WHERE titulo = :t"
            ),
            {
                "base": base,
                "primera": primera_respuesta,
                "resol": resolucion,
                "t": titulo,
            },
        )
        await s.commit()


async def _fijar_timestamps(
    engine: AsyncEngine,
    titulo: str,
    fecha_creacion: datetime,
    fecha_primera_respuesta: datetime | None,
    fecha_resolucion: datetime | None,
) -> None:
    """Fija timestamps absolutos (UTC naive) para un ticket.

    Util para ejercer la logica de horario laboral con valores conocidos
    sin depender de la hora de ejecucion del test.
    """
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        await s.execute(
            text(
                "UPDATE tickets SET"
                " fecha_creacion = :c,"
                " fecha_actualizacion = :c,"
                " fecha_primera_respuesta = :p,"
                " fecha_resolucion = :r"
                " WHERE titulo = :t"
            ),
            {
                "c": fecha_creacion,
                "p": fecha_primera_respuesta,
                "r": fecha_resolucion,
                "t": titulo,
            },
        )
        if fecha_resolucion is not None:
            await s.execute(
                text("UPDATE tickets SET estado = 'resuelto' WHERE titulo = :t"),
                {"t": titulo},
            )
        await s.commit()


async def _crear_ticket(client, tok: str, **overrides) -> dict:  # type: ignore[no-untyped-def]
    r = await client.post("/api/tickets", headers=auth_header(tok), json=_ticket_body(**overrides))
    assert r.status_code == 201, r.text
    return r.json()


async def _fijar_prioridad(client, tid: str, prioridad: str) -> None:  # type: ignore[no-untyped-def]
    """Cambia la prioridad del ticket con usuario mesa (umbral SLA es 'en vivo')."""
    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.patch(
        f"/api/tickets/{tid}/prioridad",
        headers=auth_header(mesa),
        json={"prioridad": prioridad},
    )
    assert r.status_code == 200, r.text
    assert r.json()["prioridad"] == prioridad


async def _sla_por_empresa(client, empresa_id: int = 1) -> dict:  # type: ignore[no-untyped-def]
    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/sla", headers=auth_header(mesa))
    assert r.status_code == 200, r.text
    data = r.json()
    return next(e for e in data["por_empresa"] if e["empresa_id"] == empresa_id)


async def test_crear_ticket_guarda_punto_venta_y_deriva_nombre(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    assert r.status_code == 200, r.text
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    t = await _crear_ticket(client, tok, punto_venta_id=pvs["PV Riosucio"])
    assert t["punto_venta_id"] == pvs["PV Riosucio"]
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


async def test_sla_media_ignora_elemento_y_ciudad(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Media = 96h flat: un P.Vta remoto (umbral 48h si fuera urgente) con 90h EN SLA."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    t = await _crear_ticket(client, tok, titulo="Media 90h", punto_venta_id=pvs["PV Riosucio"])
    await _fijar_prioridad(client, t["id"], "media")
    await _marcar_resuelto(db_engine, "Media 90h", frt_min=5, resolucion_horas=90)

    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 1
    assert round(d["mttr_media_horas"], 1) == 90.0
    assert d["mttr_urgente_horas"] is None
    assert d["mttr_baja_horas"] is None


async def test_sla_media_100h_fuera(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    t = await _crear_ticket(client, tok, titulo="Media 100h")
    await _fijar_prioridad(client, t["id"], "media")
    await _marcar_resuelto(db_engine, "Media 100h", frt_min=5, resolucion_horas=100)

    d = await _sla_por_empresa(client)
    assert d["total_tickets"] == 1
    assert d["tickets_en_sla"] == 0
    assert round(d["mttr_media_horas"], 1) == 100.0


async def test_sla_baja_140h_en_y_150h_fuera(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    t1 = await _crear_ticket(client, tok, titulo="Baja 140h")
    await _fijar_prioridad(client, t1["id"], "baja")
    await _marcar_resuelto(db_engine, "Baja 140h", frt_min=5, resolucion_horas=140)

    t2 = await _crear_ticket(client, tok, titulo="Baja 150h")
    await _fijar_prioridad(client, t2["id"], "baja")
    await _marcar_resuelto(db_engine, "Baja 150h", frt_min=5, resolucion_horas=150)

    d = await _sla_por_empresa(client)
    assert d["total_tickets"] == 2
    assert d["tickets_en_sla"] == 1
    assert abs(d["mttr_baja_horas"] - 145.0) < 0.1
    assert d["mttr_media_horas"] is None


async def test_sla_urgente_torre_4h(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Torre urgente: 2h EN SLA, 5h FUERA (umbral 4h, sin importar la ciudad)."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    t_ok = await _crear_ticket(
        client, tok, titulo="Torre 2h", elemento_afectado="torre", punto_venta_id=None
    )
    await _fijar_prioridad(client, t_ok["id"], "urgente")
    await _marcar_resuelto(db_engine, "Torre 2h", frt_min=5, resolucion_horas=2)

    t_fuera = await _crear_ticket(
        client, tok, titulo="Torre 5h", elemento_afectado="torre", punto_venta_id=None
    )
    await _fijar_prioridad(client, t_fuera["id"], "urgente")
    await _marcar_resuelto(db_engine, "Torre 5h", frt_min=5, resolucion_horas=5)

    d = await _sla_por_empresa(client)
    assert d["total_tickets"] == 2
    assert d["tickets_en_sla"] == 1
    assert abs(d["mttr_urgente_horas"] - 3.5) < 0.1
    assert d["mttr_media_horas"] is None


async def test_sla_urgente_punto_venta_local_24h(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """P.Vta en Manizales urgente: 20h EN SLA (24h)."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    t = await _crear_ticket(client, tok, titulo="PV Local 20h", punto_venta_id=pvs["PV Centro"])
    await _fijar_prioridad(client, t["id"], "urgente")
    await _marcar_resuelto(db_engine, "PV Local 20h", frt_min=5, resolucion_horas=20)

    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 1
    assert abs(d["mttr_urgente_horas"] - 20.0) < 0.1


async def test_sla_urgente_punto_venta_remota_48h(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """P.Vta urgente en ciudad remota: 30h EN SLA (48h) y 36h EN SLA."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    t1 = await _crear_ticket(client, tok, titulo="Remota 30h", punto_venta_id=pvs["PV Riosucio"])
    await _fijar_prioridad(client, t1["id"], "urgente")
    await _marcar_resuelto(db_engine, "Remota 30h", frt_min=5, resolucion_horas=30)

    t2 = await _crear_ticket(client, tok, titulo="Remota 36h", punto_venta_id=pvs["PV Riosucio"])
    await _fijar_prioridad(client, t2["id"], "urgente")
    await _marcar_resuelto(db_engine, "Remota 36h", frt_min=5, resolucion_horas=36)

    d = await _sla_por_empresa(client)
    assert d["total_tickets"] == 2
    assert d["tickets_en_sla"] == 2
    assert abs(d["mttr_urgente_horas"] - 33.0) < 0.1


async def test_sla_urgente_pv_local_30h_fuera(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """P.Vta local urgente con 36h excede 24h -> fuera de SLA."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    t = await _crear_ticket(client, tok, titulo="Local 36h", punto_venta_id=pvs["PV Centro"])
    await _fijar_prioridad(client, t["id"], "urgente")
    await _marcar_resuelto(db_engine, "Local 36h", frt_min=5, resolucion_horas=36)

    d = await _sla_por_empresa(client)
    assert d["total_tickets"] == 1
    assert d["tickets_en_sla"] == 0


async def test_sla_reclasificacion_en_vivo_por_prioridad(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Ticket media resuelto en 30h esta EN SLA (96h); al subir prioridad a urgente
    pasa a FUERA (P.Vta local, umbral 24h). El umbral sigue la prioridad actual."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    r = await client.get("/api/puntos-venta", headers=auth_header(tok))
    pvs = {pv["nombre"]: pv["id"] for pv in r.json()["items"]}

    t = await _crear_ticket(client, tok, titulo="Reclas 30h", punto_venta_id=pvs["PV Centro"])
    await _fijar_prioridad(client, t["id"], "media")
    await _marcar_resuelto(db_engine, "Reclas 30h", frt_min=5, resolucion_horas=30)

    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 1

    await _fijar_prioridad(client, t["id"], "urgente")
    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 0
    assert d["mttr_media_horas"] is None
    assert abs(d["mttr_urgente_horas"] - 30.0) < 0.1


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
async def test_sla_municipios_base_24h_en_urgente(
    client, db_session, db_engine, ciudad, resolucion_horas
):  # type: ignore[no-untyped-def]
    """Municipios base: con prioridad urgente el umbral es 24h (con 20h EN, con 30h FUERA).
    Si se midieran con 48h, el caso de 30h daria EN SLA y el test fallaria."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    pv = PuntoVenta(empresa_id=1, nombre=f"PV {ciudad}", ciudad=ciudad)
    db_session.add(pv)
    await db_session.commit()
    await db_session.refresh(pv)

    t = await _crear_ticket(
        client, tok, titulo=f"T {ciudad} {resolucion_horas}h", punto_venta_id=pv.id
    )
    await _fijar_prioridad(client, t["id"], "urgente")
    await _marcar_resuelto(
        db_engine, f"T {ciudad} {resolucion_horas}h", frt_min=5, resolucion_horas=resolucion_horas
    )

    d = await _sla_por_empresa(client)
    assert d["total_tickets"] == 1
    esta_en_sla = d["tickets_en_sla"] == 1
    if resolucion_horas <= 24:
        assert esta_en_sla, f"{ciudad} con {resolucion_horas}h debe estar EN SLA (umbral 24h)"
    else:
        assert not esta_en_sla, f"{ciudad} con {resolucion_horas}h debe estar FUERA de SLA (24h)"


async def test_sla_respeta_horario_laboral_nacido_de_noche(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Torre urgente creada 02:00 Bogota y resuelta 10:00 Bogota.

    Reloj de pared: 8h (fuera del umbral 4h). Horario laboral: 3h (dentro).
    """
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    t = await _crear_ticket(
        client, tok, titulo="Horario noche 3h", elemento_afectado="torre", punto_venta_id=None
    )
    await _fijar_prioridad(client, t["id"], "urgente")
    await _fijar_timestamps(
        db_engine,
        "Horario noche 3h",
        datetime(2026, 10, 10, 7, 0, 0),    # 02:00 Bogota
        datetime(2026, 10, 10, 12, 10, 0),  # 07:10 Bogota -> FRT 10min
        datetime(2026, 10, 10, 15, 0, 0),
    )

    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 1
    assert abs(d["mttr_urgente_horas"] - 3.0) < 0.05


async def test_sla_agente_hero_antes_del_arranque(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Torre urgente creada 22:00 Bogota y resuelta 05:00 dia siguiente.

    Reloj de pared: 7h (fuera del umbral 4h). Horario laboral: 0h (dentro).
    """
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    t = await _crear_ticket(
        client, tok, titulo="Horario heroe 0h", elemento_afectado="torre", punto_venta_id=None
    )
    await _fijar_prioridad(client, t["id"], "urgente")
    await _fijar_timestamps(
        db_engine,
        "Horario heroe 0h",
        datetime(2026, 10, 11, 3, 0, 0),     # 22:00 Bogota dia 10
        datetime(2026, 10, 11, 10, 10, 0),  # 05:10 Bogota dia 11 -> FRT 0
        datetime(2026, 10, 11, 10, 10, 0),
    )

    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 1
    assert d["mttr_urgente_horas"] == 0.0


async def test_sla_horario_laboral_no_pausa_noches(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Ticket media creado 18:00 Bogota y resuelto 09:00 al dia siguiente.

    Debe dar 15h (continuo desde que nacio en horario), no solo las horas
    dentro de la franja 7-21.
    """
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    t = await _crear_ticket(client, tok, titulo="Horario continuo 15h")
    await _fijar_prioridad(client, t["id"], "media")
    await _fijar_timestamps(
        db_engine,
        "Horario continuo 15h",
        datetime(2026, 10, 10, 23, 0, 0),    # 18:00 Bogota
        datetime(2026, 10, 10, 23, 10, 0),  # 18:10 Bogota -> FRT 10min
        datetime(2026, 10, 11, 14, 0, 0),   # 09:00 Bogota dia 11
    )

    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 1
    assert abs(d["mttr_media_horas"] - 15.0) < 0.05


async def test_sla_no_descuenta_pausa_antes_del_arranque_del_reloj(
    client, db_session, db_engine
):  # type: ignore[no-untyped-def]
    """Una pausa 04:00-06:00 de Bogota no se resta si el SLA arranca a las 07:00."""
    await _seed_escenario(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    t = await _crear_ticket(
        client,
        tok,
        titulo="Pausa antes del SLA",
        elemento_afectado="torre",
        punto_venta_id=None,
    )
    await _fijar_prioridad(client, t["id"], "urgente")

    hoy = date.today()
    creado = datetime.combine(hoy, time(3, 0))  # 22:00 Bogota del dia anterior
    primera_respuesta = datetime.combine(hoy, time(12, 10))  # 07:10 Bogota
    resolucion = datetime.combine(hoy, time(17, 0))  # 12:00 Bogota
    await _fijar_timestamps(
        db_engine,
        "Pausa antes del SLA",
        creado,
        primera_respuesta,
        resolucion,
    )

    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        await s.execute(
            text(
                "UPDATE tickets SET segundos_pausa_acumulado = 7200, "
                "segundos_pausa_sla_acumulado = 0 WHERE titulo = :t"
            ),
            {"t": "Pausa antes del SLA"},
        )
        await s.commit()

    d = await _sla_por_empresa(client)
    assert d["tickets_en_sla"] == 0
    assert abs(d["mttr_urgente_horas"] - 5.0) < 0.05
