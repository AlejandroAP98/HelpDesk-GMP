"""Utilidades de seguridad: hashing bcrypt y JWT (acceso + refresh)."""
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = settings.jwt_algorithm
ACCESS_SUBJECT = "access"
REFRESH_SUBJECT = "refresh"


def hash_password(plain: str) -> str:
    pw = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        pw = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(sub: str, subject: str, expires_delta: timedelta, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(sub: str, extra: dict[str, Any] | None = None) -> str:
    return _create_token(
        sub, ACCESS_SUBJECT, timedelta(minutes=settings.access_token_expire_minutes), extra
    )


def create_refresh_token(sub: str) -> str:
    extra = {"jti": uuid4().hex}
    return _create_token(
        sub, REFRESH_SUBJECT, timedelta(days=settings.refresh_token_expire_days), extra
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])


def decode_access_token(token: str) -> dict[str, Any]:
    payload = decode_token(token)
    if payload.get("type") != ACCESS_SUBJECT:
        raise JWTError("Token no es de tipo access")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    payload = decode_token(token)
    if payload.get("type") != REFRESH_SUBJECT:
        raise JWTError("Token no es de tipo refresh")
    return payload