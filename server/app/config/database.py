from collections.abc import Generator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config.settings import get_settings

_pool: ConnectionPool | None = None


def _connection_kwargs() -> dict:
    settings = get_settings()
    return {
        "host": settings.db_host,
        "port": settings.db_port,
        "dbname": settings.db_name,
        "user": settings.db_user,
        "password": settings.db_password,
        "row_factory": dict_row,
        "connect_timeout": 3,
    }


def init_pool() -> ConnectionPool:
    global _pool

    if _pool is None:
        _pool = ConnectionPool(
            "",
            min_size=0,
            max_size=10,
            timeout=3.0,
            kwargs=_connection_kwargs(),
            open=True,
        )

    return _pool


def close_pool() -> None:
    global _pool

    if _pool is not None:
        _pool.close()
        _pool = None


def get_pool() -> ConnectionPool:
    if _pool is None:
        return init_pool()
    return _pool


@contextmanager
def get_connection() -> Generator:
    pool = get_pool()
    with pool.connection() as connection:
        yield connection


def check_database() -> dict:
    with psycopg.connect(**_connection_kwargs()) as connection:
        with connection.cursor() as cur:
            cur.execute("SELECT NOW() AS current_time")
            return cur.fetchone()
