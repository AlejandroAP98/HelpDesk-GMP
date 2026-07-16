"""Tests de adjuntos: validacion de tipo MIME, magic bytes y flujo basico."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.helpers import (
    auth_header,
    login_token,
    seed_categoria,
    seed_empresa,
    seed_usuario,
)


JPEG_MAGIC = b"\xff\xd8\xff\xe0"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
PDF_MAGIC = b"%PDF-1.4\n"


def _fake_s3() -> MagicMock:
    mock = MagicMock()
    mock.upload_fileobj = MagicMock(return_value=None)
    mock.delete_object = MagicMock(return_value=None)
    mock.generate_presigned_url = MagicMock(
        return_value="http://minio:9000/adjuntos/fake?signature=abc&expires=123",
    )
    return mock


@pytest.fixture
def s3_mock():
    """Parchea el cliente S3 global del storage para evitar tocar MinIO real."""
    mock = _fake_s3()
    with patch("app.core.storage.get_s3", return_value=mock), \
         patch("app.core.storage.generate_signed_url",
               return_value="http://minio:9000/adjuntos/fake?signed=1"):
        yield mock


async def _crear_ticket(client, tok):  # type: ignore[no-untyped-def]
    r = await client.post(
        "/api/tickets",
        headers=auth_header(tok),
        json={"titulo": "T", "descripcion": "D", "categoria_id": 1, "prioridad": "media"},
    )
    return r.json()["id"]


async def _setup_basico(db_session):  # type: ignore[no-untyped-def]
    await seed_empresa(db_session, pk=1)
    await seed_usuario(db_session, email="c@test.com", password="Password12345", rol="cliente", empresa_id=1)
    await seed_categoria(db_session, nombre="HW")


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

    contenido = JPEG_MAGIC + b"\x00" * 200
    r = await client.post(
        f"/api/tickets/{tid}/adjuntos",
        headers=auth_header(tok),
        files={"file": ("captura.jpg", contenido, "image/jpeg")},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["tipo_mime"] == "image/jpeg"
    assert data["tamano_bytes"] == len(contenido)
    assert data["archivo_url"].startswith("http")
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
