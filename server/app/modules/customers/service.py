from typing import Any

from app.config.database import get_connection
from app.utils.errors import AppError


def get_customers(
    *,
    user_id: str,
    role: str,
    search: str | None = None,
) -> list[dict[str, Any]]:
    values: list[Any] = []
    conditions = ["c.is_active = TRUE"]

    if role != "ADMIN":
        values.append(user_id)
        conditions.append(f"c.assigned_user_id = %s")

    if search and search.strip():
        values.append(f"%{search.strip()}%")
        conditions.append(
            """
            (
              c.customer_name ILIKE %s
              OR c.stb_number ILIKE %s
              OR c.phone ILIKE %s
              OR c.place ILIKE %s
            )
            """
        )
        # expand same pattern 4 times for ILIKE params
        pattern = values.pop()
        values.extend([pattern, pattern, pattern, pattern])

    where_sql = " AND ".join(conditions)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  c.id,
                  c.customer_name,
                  c.stb_number,
                  c.phone,
                  c.place_id,
                  c.place,
                  c.package_id,
                  p.package_name,
                  p.monthly_amount AS package_monthly_amount,
                  c.assigned_user_id,
                  u.username AS assigned_username,
                  u.full_name AS assigned_user_name,
                  c.display_order,
                  c.remarks,
                  c.is_active,
                  c.created_at,
                  c.updated_at,
                  COALESCE(op.overpaid_amount, 0) AS overpaid_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                LEFT JOIN (
                  SELECT
                    cbs.customer_id,
                    SUM(GREATEST(cbs.total_paid - cbs.due_amount, 0)) AS overpaid_amount
                  FROM customer_billing_summary cbs
                  WHERE cbs.is_effective = TRUE
                  GROUP BY cbs.customer_id
                ) op
                  ON op.customer_id = c.id
                WHERE {where_sql}
                ORDER BY
                  c.assigned_user_id ASC,
                  c.place_id ASC NULLS LAST,
                  c.display_order ASC,
                  c.customer_name ASC
                """,
                values,
            )
            return cur.fetchall()


def get_customer_by_id(
    *,
    customer_id: str,
    user_id: str,
    role: str,
) -> dict[str, Any] | None:
    values: list[Any] = [customer_id]
    ownership = ""

    if role != "ADMIN":
        values.append(user_id)
        ownership = "AND c.assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  c.id,
                  c.customer_name,
                  c.stb_number,
                  c.phone,
                  c.place_id,
                  c.place,
                  c.package_id,
                  p.package_name,
                  p.monthly_amount AS package_monthly_amount,
                  c.assigned_user_id,
                  u.username AS assigned_username,
                  u.full_name AS assigned_user_name,
                  c.display_order,
                  c.remarks,
                  c.is_active,
                  c.created_at,
                  c.updated_at
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                WHERE c.id = %s
                  AND c.is_active = TRUE
                  {ownership}
                """,
                values,
            )
            return cur.fetchone()


def create_customer(payload: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(MAX(display_order) + 1, 0) AS next_order
                FROM customers
                WHERE assigned_user_id = %s
                  AND place_id IS NOT DISTINCT FROM %s
                """,
                (payload["assigned_user_id"], payload["place_id"]),
            )
            next_order = cur.fetchone()["next_order"]
            cur.execute(
                """
                INSERT INTO customers (
                  customer_name,
                  stb_number,
                  phone,
                  place_id,
                  place,
                  package_id,
                  assigned_user_id,
                  display_order,
                  remarks
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                  id,
                  customer_name,
                  stb_number,
                  phone,
                  place_id,
                  place,
                  package_id,
                  assigned_user_id,
                  display_order,
                  remarks,
                  is_active,
                  created_at,
                  updated_at
                """,
                (
                    payload["customer_name"],
                    payload["stb_number"],
                    payload.get("phone"),
                    payload["place_id"],
                    payload.get("place"),
                    payload["package_id"],
                    payload["assigned_user_id"],
                    next_order,
                    payload.get("remarks"),
                ),
            )
            customer = cur.fetchone()
            conn.commit()
            return customer


def update_customer(
    *,
    customer_id: str,
    user_id: str,
    role: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    values: list[Any] = [
        payload["customer_name"],
        payload["stb_number"],
        payload.get("phone"),
        payload["place_id"],
        payload.get("place"),
        payload["package_id"],
        payload.get("remarks"),
        customer_id,
    ]
    ownership = ""

    if role != "ADMIN":
        values.append(user_id)
        ownership = "AND assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE customers
                SET
                  customer_name = %s,
                  stb_number = %s,
                  phone = %s,
                  place_id = %s,
                  place = %s,
                  package_id = %s,
                  remarks = %s,
                  updated_at = NOW()
                WHERE id = %s
                  AND is_active = TRUE
                  {ownership}
                RETURNING
                  id,
                  customer_name,
                  stb_number,
                  phone,
                  place_id,
                  place,
                  package_id,
                  assigned_user_id,
                  display_order,
                  remarks,
                  is_active,
                  created_at,
                  updated_at
                """,
                values,
            )
            customer = cur.fetchone()
            conn.commit()
            return customer


def set_customer_status(
    *,
    customer_id: str,
    user_id: str,
    role: str,
    is_active: bool,
) -> dict[str, Any] | None:
    values: list[Any] = [is_active, customer_id]
    ownership = ""

    if role != "ADMIN":
        values.append(user_id)
        ownership = "AND assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE customers
                SET
                  is_active = %s,
                  updated_at = NOW()
                WHERE id = %s
                  {ownership}
                RETURNING
                  id,
                  customer_name,
                  stb_number,
                  is_active,
                  updated_at
                """,
                values,
            )
            customer = cur.fetchone()
            conn.commit()
            return customer


def update_customer_order(
    *,
    customer_id: str,
    user_id: str,
    role: str,
    display_order: int,
) -> dict[str, Any] | None:
    values: list[Any] = [display_order, customer_id]
    ownership = ""

    if role != "ADMIN":
        values.append(user_id)
        ownership = "AND assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE customers
                SET
                  display_order = %s,
                  updated_at = NOW()
                WHERE id = %s
                  AND is_active = TRUE
                  {ownership}
                RETURNING
                  id,
                  customer_name,
                  display_order,
                  updated_at
                """,
                values,
            )
            customer = cur.fetchone()
            conn.commit()
            return customer


def assign_customer(
    *,
    customer_id: str,
    assigned_user_id: str,
) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE customers c
                SET
                  assigned_user_id = %s,
                  display_order = COALESCE((
                    SELECT MAX(x.display_order) + 1
                    FROM customers x
                    WHERE x.assigned_user_id = %s
                      AND x.place_id IS NOT DISTINCT FROM c.place_id
                  ), 0),
                  updated_at = NOW()
                WHERE c.id = %s
                  AND c.is_active = TRUE
                RETURNING
                  id,
                  customer_name,
                  stb_number,
                  assigned_user_id,
                  display_order,
                  updated_at
                """,
                (assigned_user_id, assigned_user_id, customer_id),
            )
            customer = cur.fetchone()
            conn.commit()
            return customer


def reorder_customers(
    *,
    ordered_ids: list[str],
    user_id: str,
    role: str,
) -> int:
    unique_ids = list(dict.fromkeys(ordered_ids))

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, assigned_user_id, place_id
                FROM customers
                WHERE id = ANY(%s)
                  AND is_active = TRUE
                """,
                (unique_ids,),
            )
            rows = cur.fetchall()

            if len(rows) != len(unique_ids):
                raise AppError(
                    code="REORDER_INVALID",
                    message=(
                        "One or more customers were not found or are inactive."
                    ),
                    status_code=404,
                )

            owner_ids = {str(row["assigned_user_id"]) for row in rows}
            place_ids = {row["place_id"] for row in rows}

            if len(owner_ids) != 1 or len(place_ids) != 1:
                raise AppError(
                    code="REORDER_SCOPE_MISMATCH",
                    message=(
                        "Customers must belong to the same collector and place."
                    ),
                    status_code=400,
                )

            owner_id = next(iter(owner_ids))
            if role != "ADMIN" and owner_id != str(user_id):
                raise AppError(
                    code="FORBIDDEN",
                    message="You can only reorder your own customers.",
                    status_code=403,
                )

            for index, customer_id in enumerate(unique_ids):
                cur.execute(
                    """
                    UPDATE customers
                    SET
                      display_order = %s,
                      updated_at = NOW()
                    WHERE id = %s
                    """,
                    (index, customer_id),
                )

            conn.commit()
            return len(unique_ids)
