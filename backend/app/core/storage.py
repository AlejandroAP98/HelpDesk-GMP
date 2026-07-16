"""Cliente MinIO/S3 unificado para almacenamiento de adjuntos."""
from __future__ import annotations

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
        # Policy public read opcional (no hacer por defecto):
        # _s3_client.set_bucket_policy(Bucket=..., Policy=...)


def _rehost_to_public(signed_url: str) -> str:
    """Reescribe el host de una URL prefirmada para que el navegador pueda
    acceder a MinIO. Boto3 genera la URL con `minio_endpoint` (interno);
    si `minio_public_endpoint` esta definido, se reemplaza por el publico."""
    public = settings.minio_public_endpoint.strip()
    if not public:
        return signed_url
    internal = f"{'https' if settings.minio_use_ssl else 'http'}://{settings.minio_endpoint}"
    if internal in signed_url:
        return signed_url.replace(internal, public.rstrip("/"), 1)
    return signed_url


def generate_signed_url(object_key: str, expiration_seconds: int = 3600) -> str:
    """Genera una URL prefirmada (GET) para acceder al objeto en MinIO.
    `expiration_seconds` define el TTL (default 1h)."""
    url = _s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": object_key},
        ExpiresIn=expiration_seconds,
    )
    return _rehost_to_public(url)
