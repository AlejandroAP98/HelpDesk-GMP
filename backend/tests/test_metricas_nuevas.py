"""Tests de los endpoints nuevos /metricas/tendencia y del % FRT cumplido.

conftest fuerza RESEND_API_KEY="" para que ningun test consuma cuota real.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

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


async def _seed_minimo(db_session) -> None:  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="Susuerte")
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


async def _set_ticket_offsets(
    engine,
    titulo: str,
    dias_atras_creacion: int,
    minutos_hasta_frt: int | None,
    horas_hasta_resol: float | None,
) -> None:  # type: ignore[no-untyped-def]
    """Define fecha_creacion = ahora - N dias; las marcas FRT/resolucion se
    calculan desde current_timestamp (no desde fecha_creacion) para evitar la
    semantica UPDATE de Postgres (cada columna evalua con el valor viejo de
    la fila)."""
    Session = async_sessionmaker(engine, expire_on_commit=False)
    params: dict = {"dias": dias_atras_creacion, "t": titulo}
    set_clauses = ["fecha_creacion = current_timestamp - make_interval(days => :dias)"]
    if minutos_hasta_frt is not None:
        set_clauses.append(
            "fecha_primera_respuesta = current_timestamp - make_interval(days => :dias)"
            f" + make_interval(mins => {minutos_hasta_frt})"
        )
    if horas_hasta_resol is not None:
        set_clauses.append(
            "fecha_resolucion = current_timestamp - make_interval(days => :dias)"
            f" + make_interval(hours => {horas_hasta_resol})"
        )
        set_clauses.append("estado = 'resuelto'")
    sql = f"UPDATE tickets SET {', '.join(set_clauses)} WHERE titulo = :t"
    async with Session() as s:
        await s.execute(text(sql), params)
        await s.commit()


async def test_tendencia_rinde_dias_sin_datos(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Default: ultimos 30 dias; los dias sin tickets quedan con creados=0/resueltos=0."""
    await _seed_minimo(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(titulo="Hoy", descripcion="D1"),
    )
    assert r.status_code == 201, r.text
    await _set_ticket_offsets(db_engine, "Hoy", 0, None, None)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/tendencia", headers=auth_header(mesa))
    assert r.status_code == 200, r.text
    data = r.json()
    serie = data["por_dia"]
    assert len(serie) == 30
    assert serie[0]["creados"] == 0
    assert serie[-1]["creados"] == 1
    assert all(isinstance(item["creados"], int) for item in serie)
    assert all(isinstance(item["resueltos"], int) for item in serie)


async def test_tendencia_rango_explicito_cuenta_creados_y_resueltos(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Tickets creados y resueltos en dias especificos del rango se cuentan
    correctamente; los dias sin movimiento quedan con 0."""
    await _seed_minimo(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    for t in ["Antiguo resuelto", "Hoy sin resolver"]:
        r = await client.post(
            "/api/tickets",
            headers=auth_header(tok),
            json=_ticket_body(titulo=t, descripcion="d"),
        )
        assert r.status_code == 201, r.text

    await _set_ticket_offsets(db_engine, "Antiguo resuelto", 5, 5, 4)
    await _set_ticket_offsets(db_engine, "Hoy sin resolver", 0, None, None)

    hoy = date.today()
    inicio_dt = hoy - timedelta(days=6)
    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get(
        f"/api/metricas/tendencia?fecha_inicio={inicio_dt.isoformat()}&fecha_fin={hoy.isoformat()}",
        headers=auth_header(mesa),
    )
    assert r.status_code == 200, r.text
    serie = r.json()["por_dia"]
    assert len(serie) == 7
    creado_total = sum(item["creados"] for item in serie)
    resuelto_total = sum(item["resueltos"] for item in serie)
    assert creado_total == 2
    assert resuelto_total == 1


async def test_tendencia_filtra_por_empresa(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Las dos empresas coexisten; la consulta por empresa_id solo trae los suyos."""
    await _seed_minimo(db_session)
    await seed_empresa(db_session, pk=2, nombre="Otra")
    await login_token(client, "c@test.com", "Password12345")

    for titulo, emp_id in [("Emp1 hoy", 1), ("Emp2 hoy", 2)]:
        await db_session.execute(
            text(
                "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, subcategoria_id,"
                " elemento_afectado, titulo, descripcion, prioridad, estado)"
                " VALUES (:emp, (SELECT id FROM usuarios WHERE email='c@test.com'), 1, 1,"
                " 'punto_venta', :t, 'd', 'media', 'abierto')"
            ),
            {"emp": emp_id, "t": titulo},
        )
    await db_session.commit()

    hoy = date.today().isoformat()
    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get(
        f"/api/metricas/tendencia?fecha_inicio={hoy}&fecha_fin={hoy}&empresa_id=1",
        headers=auth_header(mesa),
    )
    serie = r.json()["por_dia"]
    assert serie[0]["creados"] == 1


async def test_tiempos_incluye_porcentaje_frt_cumplido(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """El % FRT cumplido refleja cuantos tickets entran en el objetivo de 30 min."""
    await _seed_minimo(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    for t in ["OK 1", "OK 2", "Lento"]:
        r = await client.post(
            "/api/tickets",
            headers=auth_header(tok),
            json=_ticket_body(titulo=t, descripcion="d"),
        )
        assert r.status_code == 201, r.text

    await _set_ticket_offsets(db_engine, "OK 1", 0, 5, None)
    await _set_ticket_offsets(db_engine, "OK 2", 0, 20, None)
    await _set_ticket_offsets(
        db_engine,
        "Lento",
        0,
        60,
        None,
    )

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/tiempos", headers=auth_header(mesa))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["tickets_con_primera_respuesta"] == 3
    assert data["porcentaje_frt_cumplido"] is not None
    expected = round((2 / 3) * 100, 1)
    assert data["porcentaje_frt_cumplido"] == expected


async def test_tiempos_porcentaje_frt_null_sin_datos(client, db_session):  # type: ignore[no-untyped-def]
    """Sin tickets con FRT, porcentaje_frt_cumplido es null (no 0)."""
    await _seed_minimo(db_session)

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get("/api/metricas/tiempos", headers=auth_header(mesa))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["porcentaje_frt_cumplido"] is None


async def test_distribucion_cuenta_por_dia_y_hora(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Heatmap: cada ticket se cuenta en su dow y hora exactos en zona Colombia.
    Los timestamps son UTC; el bucketing los lleva a America/Bogota."""
    await _seed_minimo(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    for titulo in ("T1", "T2", "T3"):
        r = await client.post(
            "/api/tickets",
            headers=auth_header(tok),
            json=_ticket_body(titulo=titulo, descripcion="d"),
        )
        assert r.status_code == 201, r.text

    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        # T1: 2099-01-05 15:00 UTC = 2099-01-05 10:00 COL (lunes, hora 10)
        await s.execute(
            text("UPDATE tickets SET fecha_creacion = '2099-01-05 15:00:00' WHERE titulo = 'T1'")
        )
        # T2: 2099-01-05 19:00 UTC = 2099-01-05 14:00 COL (lunes, hora 14)
        await s.execute(
            text("UPDATE tickets SET fecha_creacion = '2099-01-05 19:00:00' WHERE titulo = 'T2'")
        )
        # T3: 2099-01-07 19:00 UTC = 2099-01-07 14:00 COL (miercoles, hora 14)
        await s.execute(
            text("UPDATE tickets SET fecha_creacion = '2099-01-07 19:00:00' WHERE titulo = 'T3'")
        )
        await s.commit()

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get(
        "/api/metricas/distribucion?fecha_inicio=2099-01-01&fecha_fin=2099-01-31",
        headers=auth_header(mesa),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 3
    celdas = {(c["dow"], c["hora"]): c["cantidad"] for c in data["por_dia_hora"]}
    assert celdas.get((1, 10)) == 1
    assert celdas.get((1, 14)) == 1
    assert celdas.get((3, 14)) == 1


async def test_distribucion_zonahoraria_colombia(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    """Un ticket a las 03:00 UTC del lunes cae en domingo 22:00 COL, no en lunes 03:00."""
    await _seed_minimo(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")

    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json=_ticket_body(titulo="Noche_COL", descripcion="d"),
    )
    assert r.status_code == 201, r.text

    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as s:
        # 2099-01-05 03:00 UTC = 2099-01-04 22:00 COL (domingo, hora 22)
        await s.execute(
            text(
                "UPDATE tickets SET fecha_creacion = '2099-01-05 03:00:00' WHERE titulo = 'Noche_COL'"
            )
        )
        await s.commit()

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get(
        "/api/metricas/distribucion?fecha_inicio=2099-01-01&fecha_fin=2099-01-31",
        headers=auth_header(mesa),
    )
    celdas = {(c["dow"], c["hora"]): c["cantidad"] for c in r.json()["por_dia_hora"]}
    assert celdas.get((0, 22)) == 1
    assert (1, 3) not in celdas


async def test_distribucion_filtra_por_empresa(client, db_session, db_engine):  # type: ignore[no-untyped-def]
    await _seed_minimo(db_session)
    await seed_empresa(db_session, pk=2, nombre="Otra")

    await db_session.execute(
        text(
            "INSERT INTO tickets (empresa_id, cliente_id, categoria_id, subcategoria_id,"
            " elemento_afectado, titulo, descripcion, prioridad, estado, fecha_creacion)"
            " VALUES (1, (SELECT id FROM usuarios WHERE email='c@test.com'), 1, 1,"
            " 'punto_venta', 'E1', 'd', 'media', 'abierto', '2099-01-05 14:00:00'),"
            " (2, (SELECT id FROM usuarios WHERE email='c@test.com'), 1, 1,"
            " 'punto_venta', 'E2', 'd', 'media', 'abierto', '2099-01-05 14:00:00')"
        )
    )
    await db_session.commit()

    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get(
        "/api/metricas/distribucion?fecha_inicio=2099-01-01&fecha_fin=2099-01-31&empresa_id=1",
        headers=auth_header(mesa),
    )
    data = r.json()
    assert data["total"] == 1


async def test_distribucion_sin_datos_total_cero(client, db_session):  # type: ignore[no-untyped-def]
    await _seed_minimo(db_session)
    mesa = await login_token(client, "mesa@test.com", "Password12345")
    r = await client.get(
        "/api/metricas/distribucion?fecha_inicio=2099-01-01&fecha_fin=2099-01-31",
        headers=auth_header(mesa),
    )
    data = r.json()
    assert data["total"] == 0
    assert data["por_dia_hora"] == []
