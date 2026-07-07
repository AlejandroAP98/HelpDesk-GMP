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