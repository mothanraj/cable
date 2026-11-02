from typing import Any

from app.config.database import get_connection
from app.utils.security import hash_password


def create_user(
    *,
    username: str,
    full_name: str,
    password: str,
) -> dict[str, Any]:
    password_hash = hash_password(password)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (
                  username,
                  password_hash,
                  full_name,
                  role
                )
                VALUES (%s, %s, %s, 'USER')
                RETURNING
                  id,
                  username,
                  full_name,
                  role,
                  is_active,
                  created_at
                """,
                (username, password_hash, full_name),
            )
            user = cur.fetchone()
            conn.commit()
            return user


def get_users() -> list[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  id,
                  username,
                  full_name,
                  role,
                  is_active,
                  created_at,
                  updated_at
                FROM users
                ORDER BY
                  CASE
                    WHEN role = 'ADMIN' THEN 0
                    ELSE 1
                  END,
                  full_name
                """
            )
            return cur.fetchall()


def reset_user_password(
    user_id: str,
    password: str,
) -> dict[str, Any] | None:
    password_hash = hash_password(password)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET
                  password_hash = %s,
                  updated_at = NOW()
                WHERE id = %s
                  AND role = 'USER'
                RETURNING
                  id,
                  username,
                  full_name,
                  role,
                  is_active
                """,
                (password_hash, user_id),
            )
            user = cur.fetchone()

            if user is None:
                conn.rollback()
                return None

            cur.execute(
                """
                UPDATE user_sessions
                SET revoked_at = NOW()
                WHERE user_id = %s
                  AND revoked_at IS NULL
                """,
                (user_id,),
            )
            conn.commit()
            return user


def set_user_status(user_id: str, is_active: bool) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET
                  is_active = %s,
                  updated_at = NOW()
                WHERE id = %s
                  AND role = 'USER'
                RETURNING
                  id,
                  username,
                  full_name,
                  role,
                  is_active
                """,
                (is_active, user_id),
            )
            user = cur.fetchone()
            conn.commit()
            return user
