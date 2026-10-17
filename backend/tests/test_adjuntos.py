"""Tests de adjuntos: validacion de tipo MIME, magic bytes, descarga y permisos."""
from __future__ import annotations

from tests.helpers import (
    auth_header,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_subcategoria,
    seed_usuario,
)


JPEG_MAGIC = b"\xff\xd8\xff\xe0"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
PDF_MAGIC = b"%PDF-1.4\n"


async def _crear_ticket(client, tok):  # type: ignore[no-untyped-def]
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={
            "titulo": "T",
            "descripcion": "D",
            "categoria_id": 1,
            "subcategoria_id": 1,
            "elemento_afectado": "punto_venta",
            "prioridad": "media",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _setup_basico(db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")


async def _subir_jpeg(client, tok, ticket_id):  # type: ignore[no-untyped-def]
    contenido = JPEG_MAGIC + b"\x00" * 200
    r = await client.post(
        f"/api/tickets/{ticket_id}/adjuntos",
        headers=auth_header(tok),
        files={"file": ("captura.jpg", contenido, "image/jpeg")},
    )
    assert r.status_code == 201, r.text
    return r.json(), contenido


async def test_rechaza_pdf(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)

    r = await client.post(
        f"/api/tickets/{tid}/adjuntos",
        headers=auth_header(tok),
        files={"file": ("doc.pdf", PDF_MAGIC + b"fake pdf body", "application/pdf")},
    )
    assert r.status_code == 409
    assert "no permitido" in r.json()["detail"].lower()
    s3_mock.upload_fileobj.assert_not_called()


async def test_rechaza_jpeg_con_extension_falsa(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)

    r = await client.post(
        f"/api/tickets/{tid}/adjuntos",
        headers=auth_header(tok),
        files={"file": ("foto.exe", JPEG_MAGIC + b"x" * 50, "image/jpeg")},
    )
    assert r.status_code == 409
    s3_mock.upload_fileobj.assert_not_called()


async def test_rechaza_jpeg_con_magic_bytes_invalidos(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)

    r = await client.post(
        f"/api/tickets/{tid}/adjuntos",
        headers=auth_header(tok),
        files={"file": ("fake.jpg", b"not a real jpeg at all" * 10, "image/jpeg")},
    )
    assert r.status_code == 409
    assert "jpeg" in r.json()["detail"].lower()
    s3_mock.upload_fileobj.assert_not_called()


async def test_acepta_jpeg_valido(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)

    data, contenido = await _subir_jpeg(client, tok, tid)
    assert data["tipo_mime"] == "image/jpeg"
    assert data["tamano_bytes"] == len(contenido)
    assert data["archivo_url"].startswith("/api/tickets/")
    assert data["archivo_url"].endswith("/archivo")
    s3_mock.upload_fileobj.assert_called_once()


async def test_acepta_png_valido(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)

    contenido = PNG_MAGIC + b"\x00" * 100
    r = await client.post(
        f"/api/tickets/{tid}/adjuntos",
        headers=auth_header(tok),
        files={"file": ("imagen.png", contenido, "image/png")},
    )
    assert r.status_code == 201, r.text
    assert r.json()["tipo_mime"] == "image/png"
    assert r.json()["archivo_url"].startswith("/api/tickets/")


async def test_listar_devuelve_ruta_relativa(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)
    await _subir_jpeg(client, tok, tid)

    r = await client.get(f"/api/tickets/{tid}/adjuntos", headers=auth_header(tok))
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["archivo_url"].startswith("/api/tickets/")
    assert items[0]["archivo_url"].endswith("/archivo")


async def test_descarga_archivo_con_sesion(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)
    data, contenido = await _subir_jpeg(client, tok, tid)
    adj_id = data["id"]

    r = await client.get(
        f"/api/tickets/{tid}/adjuntos/{adj_id}/archivo",
        headers=auth_header(tok),
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/jpeg")
    assert r.content == contenido
    s3_mock.get_object.assert_called_once()


async def test_descarga_sin_sesion_401(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)
    data, _ = await _subir_jpeg(client, tok, tid)
    adj_id = data["id"]

    r = await client.get(f"/api/tickets/{tid}/adjuntos/{adj_id}/archivo")
    assert r.status_code == 401
    s3_mock.get_object.assert_not_called()


async def test_cliente_otra_empresa_403(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1, nombre="E1")
    await seed_empresa(db_session, pk=2, nombre="E2")
    await seed_usuario(db_session, email="c1@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_usuario(db_session, email="c2@test.com", password="Password12345", rol="cliente", empresa_id=2)
    await seed_categoria(db_session, nombre="HW")
    await seed_subcategoria(db_session, categoria_id=1, nombre="HW")

    tok_c1 = await login_token(client, "c1@test.com", "Password12345")
    tok_c2 = await login_token(client, "c2@test.com", "Password12345")
    tid = await _crear_ticket(client, tok_c1)
    data, _ = await _subir_jpeg(client, tok_c1, tid)
    adj_id = data["id"]

    r = await client.get(
        f"/api/tickets/{tid}/adjuntos/{adj_id}/archivo",
        headers=auth_header(tok_c2),
    )
    assert r.status_code == 404
    s3_mock.get_object.assert_not_called()


async def test_stream_con_range_206(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)
    contenido = JPEG_MAGIC + b"\x00" * 1020
    r = await client.post(
        f"/api/tickets/{tid}/adjuntos",
        headers=auth_header(tok),
        files={"file": ("rango.jpg", contenido, "image/jpeg")},
    )
    assert r.status_code == 201, r.text
    adj_id = r.json()["id"]

    r = await client.get(
        f"/api/tickets/{tid}/adjuntos/{adj_id}/archivo",
        headers={**auth_header(tok), "Range": "bytes=0-99"},
    )
    assert r.status_code == 206
    assert r.headers.get("content-range") == f"bytes 0-99/{len(contenido)}"
    assert r.content == contenido[:100]


async def test_descarga_archivo_inexistente_en_storage_404(client, db_session, s3_mock):  # type: ignore[no-untyped-def]
    """Si el registro existe en BD pero el archivo no esta en MinIO, devuelve 404 sin romper."""
    from botocore.exceptions import ClientError

    await _setup_basico(db_session)
    tok = await login_token(client, "c@test.com", "Password12345")
    tid = await _crear_ticket(client, tok)
    data, _ = await _subir_jpeg(client, tok, tid)
    adj_id = data["id"]

    s3_mock.get_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}},
        "GetObject",
    )

    r = await client.get(
        f"/api/tickets/{tid}/adjuntos/{adj_id}/archivo",
        headers=auth_header(tok),
    )
    assert r.status_code == 404, r.text
    assert "no encontrado" in r.json()["detail"].lower()
