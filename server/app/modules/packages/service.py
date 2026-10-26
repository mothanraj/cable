from typing import Any

from app.config.database import get_connection


def get_packages(
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    inactive_filter = "" if include_inactive else "WHERE is_active = TRUE"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  (
                    id::text = COALESCE(
                      (
                        SELECT value
                        FROM system_settings
                        WHERE key = 'default_package_id'
                      ),
                      ''
                    )
                  ) AS is_default,
                  created_at,
                  updated_at
                FROM packages
                {inactive_filter}
                ORDER BY
                  monthly_amount ASC,
                  package_name ASC
                """
            )
            return cur.fetchall()


def get_package_by_id(
    package_id: str,
    *,
    active_only: bool = True,
) -> dict[str, Any] | None:
    active_filter = "AND is_active = TRUE" if active_only else ""

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  created_at,
                  updated_at
                FROM packages
                WHERE id = %s
                  {active_filter}
                """,
                (package_id,),
            )
            return cur.fetchone()


def create_package(
    *,
    package_name: str,
    monthly_amount: float,
) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO packages (
                  package_name,
                  monthly_amount
                )
                VALUES (%s, %s)
                RETURNING
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  created_at,
                  updated_at
                """,
                (package_name, monthly_amount),
            )
            package = cur.fetchone()
            conn.commit()
            return package


def update_package(
    *,
    package_id: str,
    package_name: str,
    monthly_amount: float,
) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE packages
                SET
                  package_name = %s,
                  monthly_amount = %s,
                  updated_at = NOW()
                WHERE id = %s
                RETURNING
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  created_at,
                  updated_at
                """,
                (package_name, monthly_amount, package_id),
            )
            package = cur.fetchone()
            conn.commit()
            return package


def get_default_package_id() -> str | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT value
                FROM system_settings
                WHERE key = 'default_package_id'
                """
            )
            row = cur.fetchone()
            return row["value"] if row is not None else None


def get_default_package() -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  TRUE AS is_default,
                  created_at,
                  updated_at
                FROM packages
                WHERE id::text = (
                  SELECT value
                  FROM system_settings
                  WHERE key = 'default_package_id'
                )
                  AND is_active = TRUE
                """
            )
            return cur.fetchone()


def set_default_package(package_id: str) -> dict[str, Any] | None:
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
            package = cur.fetchone()

            if package is None:
                return None

            cur.execute(
                """
                INSERT INTO system_settings (key, value)
                VALUES ('default_package_id', %s)
                ON CONFLICT (key)
                DO UPDATE SET value = EXCLUDED.value
                """,
                (str(package["id"]),),
            )
            conn.commit()

            return {**package, "is_default": True}


def set_package_status(
    *,
    package_id: str,
    is_active: bool,
) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE packages
                SET
                  is_active = %s,
                  updated_at = NOW()
                WHERE id = %s
                RETURNING
                  id,
                  package_name,
                  monthly_amount,
                  is_active,
                  created_at,
                  updated_at
                """,
                (is_active, package_id),
            )
            package = cur.fetchone()
            conn.commit()
            return package
