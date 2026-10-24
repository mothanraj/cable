from typing import Any

from psycopg import OperationalError

from app.config.database import get_connection
from app.utils.errors import AppError
from app.utils.jwt import (
    generate_access_token,
    generate_refresh_token,
    verify_refresh_token,
)
from app.utils.network import sanitize_ip
from app.utils.security import hash_token, verify_password


def _db_unavailable(exc: Exception) -> AppError:
    return AppError(
        code="DATABASE_UNAVAILABLE",
        message="Database connection is unavailable.",
        status_code=503,
    )


def login(
    username: str,
    password: str,
    metadata: dict[str, str | None] | None = None,
) -> dict[str, Any] | None:
    metadata = metadata or {}
    ip_address = sanitize_ip(metadata.get("ip_address"))

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      id,
                      username,
                      password_hash,
                      full_name,
                      role,
                      is_active
                    FROM users
                    WHERE username = %s
                    LIMIT 1
                    """,
                    (username,),
                )
                user = cur.fetchone()

                if user is None or not user["is_active"]:
                    return None

                if not verify_password(user["password_hash"], password):
                    return None

                access_token = generate_access_token(user)
                refresh_token = generate_refresh_token(user)
                refresh_token_hash = hash_token(refresh_token)

                cur.execute(
                    """
                    INSERT INTO user_sessions (
                      user_id,
                      refresh_token_hash,
                      expires_at,
                      user_agent,
                      ip_address
                    )
                    VALUES (
                      %s,
                      %s,
                      NOW() + INTERVAL '7 days',
                      %s,
                      %s
                    )
                    """,
                    (
                        user["id"],
                        refresh_token_hash,
                        metadata.get("user_agent"),
                        ip_address,
                    ),
                )
                conn.commit()
    except OperationalError as exc:
        raise _db_unavailable(exc) from exc

    return {
        "user": {
            "id": str(user["id"]),
            "username": user["username"],
            "fullName": user["full_name"],
            "role": user["role"],
        },
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }


def refresh_session(
    refresh_token: str | None,
    metadata: dict[str, str | None] | None = None,
) -> dict[str, Any] | None:
    if not refresh_token:
        return None

    metadata = metadata or {}
    ip_address = sanitize_ip(metadata.get("ip_address"))

    try:
        payload = verify_refresh_token(refresh_token)
    except Exception:
        return None

    token_hash = hash_token(refresh_token)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      s.id AS session_id,
                      s.user_id,
                      s.expires_at,
                      s.revoked_at,
                      u.username,
                      u.full_name,
                      u.role,
                      u.is_active
                    FROM user_sessions s
                    INNER JOIN users u
                      ON u.id = s.user_id
                    WHERE s.refresh_token_hash = %s
                      AND s.user_id = %s
                      AND s.revoked_at IS NULL
                      AND s.expires_at > NOW()
                      AND u.is_active = TRUE
                    LIMIT 1
                    """,
                    (token_hash, payload["sub"]),
                )
                session = cur.fetchone()

                if session is None:
                    return None

                user = {
                    "id": session["user_id"],
                    "username": session["username"],
                    "full_name": session["full_name"],
                    "role": session["role"],
                }

                access_token = generate_access_token(user)
                new_refresh_token = generate_refresh_token(user)
                new_refresh_token_hash = hash_token(new_refresh_token)

                cur.execute(
                    """
                    UPDATE user_sessions
                    SET
                      refresh_token_hash = %s,
                      last_activity_at = NOW(),
                      user_agent = COALESCE(%s, user_agent),
                      ip_address = COALESCE(%s, ip_address)
                    WHERE id = %s
                    """,
                    (
                        new_refresh_token_hash,
                        metadata.get("user_agent"),
                        ip_address,
                        session["session_id"],
                    ),
                )
                conn.commit()
    except OperationalError as exc:
        raise _db_unavailable(exc) from exc

    return {
        "user": {
            "id": str(user["id"]),
            "username": user["username"],
            "fullName": user["full_name"],
            "role": user["role"],
        },
        "accessToken": access_token,
        "refreshToken": new_refresh_token,
    }


def logout(refresh_token: str | None) -> None:
    if not refresh_token:
        return

    token_hash = hash_token(refresh_token)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE user_sessions
                    SET revoked_at = NOW()
                    WHERE refresh_token_hash = %s
                      AND revoked_at IS NULL
                    """,
                    (token_hash,),
                )
                conn.commit()
    except OperationalError as exc:
        raise _db_unavailable(exc) from exc
