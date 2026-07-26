"""Cliente MinIO/S3 unificado para almacenamiento de adjuntos."""
from __future__ import annotations

import asyncio

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from app.core.config import settings

_s3_client = boto3.client(
    "s3",
    endpoint_url=(
        f"{'https' if settings.minio_use_ssl else 'http'}://{settings.minio_endpoint}"
    ),
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key,
    region_name="us-east-1",
    config=BotoConfig(signature_version="s3v4"),
)


def get_s3() -> boto3.client:
    return _s3_client


def ensure_bucket() -> None:
    """Crea el bucket si no existe (idempotente). Llamado en lifespan startup."""
    try:
        _s3_client.head_bucket(Bucket=settings.minio_bucket)
    except ClientError:
        _s3_client.create_bucket(Bucket=settings.minio_bucket)


async def ensure_bucket_async() -> None:
    """Version async de ensure_bucket (no bloquea el event loop)."""
    await asyncio.to_thread(ensure_bucket)


async def s3_upload_fileobj(*args, **kwargs):
    """Wrapper async de S3 upload_fileobj (evita bloquear el event loop)."""
    return await asyncio.to_thread(_s3_client.upload_fileobj, *args, **kwargs)


async def s3_get_object(*args, **kwargs):
    """Wrapper async de S3 get_object (evita bloquear el event loop)."""
    return await asyncio.to_thread(_s3_client.get_object, *args, **kwargs)


async def s3_delete_object(*args, **kwargs):
    """Wrapper async de S3 delete_object (evita bloquear el event loop)."""
    return await asyncio.to_thread(_s3_client.delete_object, *args, **kwargs)
