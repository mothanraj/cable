from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    node_env: str | None = None
    port: int = 5000

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "customer_management"
    db_user: str = "postgres"
    db_password: str = ""
    db_sslmode: str = "prefer"

    jwt_access_secret: str
    jwt_refresh_secret: str

    client_url: str = "http://localhost:5173"

    jwt_issuer: str = "cable-management-api"
    jwt_audience: str = "cable-management-client"

    # Access tokens are short-lived; active work silently refreshes them.
    access_token_expires_minutes: int = 15
    refresh_token_expires_days: int = 7

    # A session ends after this long with no user interaction, and is also
    # capped at this total age even if the user never goes idle.
    idle_timeout_minutes: int = 45
    max_session_hours: int = 12

    @property
    def environment(self) -> str:
        return (self.app_env or self.node_env or "development").lower()

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.client_url.split(",")
            if origin.strip()
        ]

    @property
    def cors_origin_regex(self) -> str | None:
        if self.is_production:
            return None

        return r"http://(localhost|127\.0\.0\.1)(:\d+)?"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
