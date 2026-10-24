from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.config.settings import get_settings
from app.middleware.auth import client_metadata
from app.middleware.rate_limit import limiter
from app.modules.auth import service as auth_service
from app.utils.errors import AppError

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refreshToken"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


def _cookie_kwargs() -> dict:
    settings = get_settings()
    return {
        "key": REFRESH_COOKIE_NAME,
        "httponly": True,
        "secure": settings.is_production,
        "samesite": "lax",
        "max_age": 7 * 24 * 60 * 60,
        "path": "/api/v1/auth",
    }


@router.post("/login")
@limiter.limit("10/15minutes")
def login(request: Request, response: Response, body: LoginRequest):
    username = body.username.strip()
    password = body.password

    if not username or not password:
        raise AppError(
            code="INVALID_REQUEST",
            message="Username and password are required.",
            status_code=400,
        )

    result = auth_service.login(
        username,
        password,
        client_metadata(request),
    )

    if result is None:
        raise AppError(
            code="INVALID_CREDENTIALS",
            message="Invalid username or password.",
            status_code=401,
        )

    cookie = _cookie_kwargs()
    response.set_cookie(value=result["refreshToken"], **cookie)

    return {
        "success": True,
        "data": {
            "user": result["user"],
            "accessToken": result["accessToken"],
        },
    }


@router.post("/refresh")
def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    result = auth_service.refresh_session(
        refresh_token,
        client_metadata(request),
    )

    if result is None:
        response.delete_cookie(
            REFRESH_COOKIE_NAME,
            path="/api/v1/auth",
        )
        raise AppError(
            code="INVALID_SESSION",
            message="Session is invalid or expired.",
            status_code=401,
        )

    cookie = _cookie_kwargs()
    response.set_cookie(value=result["refreshToken"], **cookie)

    return {
        "success": True,
        "data": {
            "user": result["user"],
            "accessToken": result["accessToken"],
        },
    }


@router.post("/logout")
def logout(request: Request, response: Response):
    auth_service.logout(request.cookies.get(REFRESH_COOKIE_NAME))
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
    )
    return {
        "success": True,
        "message": "Logged out successfully.",
    }
