from typing import Any

from app.config.database import get_connection


def get_packages() -> list[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  created_at,
                  updated_at
                FROM packages
                WHERE is_active = TRUE
                ORDER BY
                  monthly_amount ASC,
                  package_name ASC
                """
            )
            return cur.fetchall()


def get_package_by_id(package_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  created_at,
                  updated_at
                FROM packages
                WHERE id = %s
                  AND is_active = TRUE
                """,
                (package_id,),
            )
            return cur.fetchone()
