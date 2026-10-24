from typing import Annotated, Any

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.utils.errors import AppError
from app.utils.jwt import verify_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> dict[str, Any]:
    if credentials is None:
        raise AppError(
            code="AUTHENTICATION_REQUIRED",
            message="Authentication is required.",
            status_code=401,
        )

    if credentials.scheme.lower() != "bearer":
        raise AppError(
            code="INVALID_AUTH_HEADER",
            message="Invalid authentication header.",
            status_code=401,
        )

    try:
        payload = verify_access_token(credentials.credentials)
    except Exception as exc:
        raise AppError(
            code="INVALID_OR_EXPIRED_TOKEN",
            message="Invalid or expired authentication token.",
            status_code=401,
        ) from exc

    return {
        "id": payload["sub"],
        "role": payload["role"],
        "username": payload["username"],
    }


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def require_roles(*allowed_roles: str):
    def dependency(user: CurrentUser) -> dict[str, Any]:
        if user["role"] not in allowed_roles:
            raise AppError(
                code="FORBIDDEN",
                message=(
                    "You do not have permission to perform this action."
                ),
                status_code=403,
            )
        return user

    return dependency


def client_metadata(request: Request) -> dict[str, str | None]:
    from app.utils.network import sanitize_ip

    forwarded = request.headers.get("x-forwarded-for")
    raw_ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else None)
    )
    return {
        "user_agent": request.headers.get("user-agent"),
        "ip_address": sanitize_ip(raw_ip),
    }
