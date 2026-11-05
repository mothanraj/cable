from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
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

# Present only in the Docker image, where the client build is copied here.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


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

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(_request: Request, _exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "error": {
                    "code": "RATE_LIMITED",
                    "message": (
                        "Too many attempts. Please wait a few minutes "
                        "before trying again."
                    ),
                },
            },
        )

    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
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

    # Serve the built React client (Docker image only). API routes above are
    # registered first, so they take precedence over this catch-all.
    if STATIC_DIR.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=STATIC_DIR / "assets"),
            name="assets",
        )

        @app.get("/{full_path:path}", include_in_schema=False)
        def serve_spa(full_path: str):
            if full_path.startswith("api/"):
                return JSONResponse(
                    status_code=404,
                    content={
                        "success": False,
                        "error": {
                            "code": "NOT_FOUND",
                            "message": "Route not found.",
                        },
                    },
                )

            candidate = (STATIC_DIR / full_path).resolve()

            if (
                full_path
                and candidate.is_file()
                and STATIC_DIR.resolve() in candidate.parents
            ):
                return FileResponse(candidate)

            return FileResponse(STATIC_DIR / "index.html")

    return app


app = create_app()
