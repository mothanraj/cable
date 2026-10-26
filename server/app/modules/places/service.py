from typing import Any

from app.config.database import get_connection


def get_places(*, include_inactive: bool = False) -> list[dict[str, Any]]:
    inactive_filter = "" if include_inactive else "WHERE is_active = TRUE"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  id,
                  place_name,
                  is_active,
                  created_at,
                  updated_at
                FROM places
                {inactive_filter}
                ORDER BY
                  place_name ASC
                """
            )
            return cur.fetchall()


def get_place_by_id(
    place_id: str,
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
                  place_name,
                  is_active,
                  created_at,
                  updated_at
                FROM places
                WHERE id = %s
                  {active_filter}
                """,
                (place_id,),
            )
            return cur.fetchone()


def create_place(place_name: str) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO places (place_name)
                VALUES (%s)
                RETURNING
                  id,
                  place_name,
                  is_active,
                  created_at,
                  updated_at
                """,
                (place_name,),
            )
            place = cur.fetchone()
            conn.commit()
            return place


def update_place(
    *,
    place_id: str,
    place_name: str,
) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE places
                SET
                  place_name = %s,
                  updated_at = NOW()
                WHERE id = %s
                RETURNING
                  id,
                  place_name,
                  is_active,
                  created_at,
                  updated_at
                """,
                (place_name, place_id),
            )
            place = cur.fetchone()

            if place is not None:
                cur.execute(
                    """
                    UPDATE customers
                    SET
                      place = %s,
                      updated_at = NOW()
                    WHERE place_id = %s
                    """,
                    (place_name, place_id),
                )

            conn.commit()
            return place


def set_place_status(
    *,
    place_id: str,
    is_active: bool,
) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE places
                SET
                  is_active = %s,
                  updated_at = NOW()
                WHERE id = %s
                RETURNING
                  id,
                  place_name,
                  is_active,
                  created_at,
                  updated_at
                """,
                (is_active, place_id),
            )
            place = cur.fetchone()
            conn.commit()
            return place
