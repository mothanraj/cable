from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt

from app.config.settings import get_settings


def _now() -> datetime:
    return datetime.now(UTC)


def generate_access_token(user: dict[str, Any]) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user["id"]),
        "role": user["role"],
        "username": user["username"],
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "exp": _now()
        + timedelta(minutes=settings.access_token_expires_minutes),
        "iat": _now(),
    }
    return jwt.encode(
        payload,
        settings.jwt_access_secret,
        algorithm="HS256",
    )


def generate_refresh_token(user: dict[str, Any]) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user["id"]),
        "tokenType": "refresh",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "exp": _now()
        + timedelta(days=settings.refresh_token_expires_days),
        "iat": _now(),
    }
    return jwt.encode(
        payload,
        settings.jwt_refresh_secret,
        algorithm="HS256",
    )


def verify_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_access_secret,
        algorithms=["HS256"],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )


def verify_refresh_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_refresh_secret,
        algorithms=["HS256"],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )


def as_uuid(value: str | UUID) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
