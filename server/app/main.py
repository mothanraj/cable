from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config.database import (
    check_database,
    close_pool,
    init_pool,
)
from app.config.settings import get_settings
from app.middleware.rate_limit import limiter
from app.modules.auth.routes import router as auth_router
from app.modules.billing.routes import router as billing_router
from app.modules.customers.routes import router as customers_router
from app.modules.dashboard.routes import router as dashboard_router
from app.modules.packages.routes import router as packages_router
from app.modules.payments.routes import router as payments_router
from app.modules.places.routes import router as places_router
from app.modules.reports.routes import router as reports_router
from app.modules.users.routes import router as users_router
from app.utils.errors import AppError


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_pool()
    yield
    close_pool()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Cable Customer Management API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.client_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request,
        exc: RequestValidationError,
    ):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Request validation failed.",
                    "details": exc.errors(),
                },
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        print(
            "Unhandled API error:",
            {
                "method": request.method,
                "path": str(request.url.path),
                "message": str(exc),
            },
        )
        if not settings.is_production:
            print(exc)

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred.",
                },
            },
        )

    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(packages_router, prefix="/api/v1")
    app.include_router(customers_router, prefix="/api/v1")
    app.include_router(places_router, prefix="/api/v1")
    app.include_router(billing_router, prefix="/api/v1")
    app.include_router(payments_router, prefix="/api/v1")
    app.include_router(dashboard_router, prefix="/api/v1")
    app.include_router(reports_router, prefix="/api/v1")

    @app.get("/api/v1/health")
    def health():
        try:
            row = check_database()
            return {
                "success": True,
                "message": "API and database are working.",
                "data": {
                    "databaseTime": row["current_time"].isoformat(),
                },
            }
        except Exception as exc:
            print("Health check failed:", exc)
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "error": {
                        "code": "DATABASE_UNAVAILABLE",
                        "message": "Database connection is unavailable.",
                    },
                },
            )

    return app


app = create_app()
