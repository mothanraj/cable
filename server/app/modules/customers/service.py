from typing import Any

from app.config.database import get_connection


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
                  c.place,
                  c.package_id,
                  p.package_name,
                  p.monthly_amount AS package_monthly_amount,
                  c.custom_monthly_amount,
                  COALESCE(
                    c.custom_monthly_amount,
                    p.monthly_amount
                  ) AS effective_monthly_amount,
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
                WHERE {where_sql}
                ORDER BY
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
                  c.place,
                  c.package_id,
                  p.package_name,
                  p.monthly_amount AS package_monthly_amount,
                  c.custom_monthly_amount,
                  COALESCE(
                    c.custom_monthly_amount,
                    p.monthly_amount
                  ) AS effective_monthly_amount,
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
                INSERT INTO customers (
                  customer_name,
                  stb_number,
                  phone,
                  place,
                  package_id,
                  custom_monthly_amount,
                  assigned_user_id,
                  remarks
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                  id,
                  customer_name,
                  stb_number,
                  phone,
                  place,
                  package_id,
                  custom_monthly_amount,
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
                    payload.get("place"),
                    payload["package_id"],
                    payload.get("custom_monthly_amount"),
                    payload["assigned_user_id"],
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
        payload.get("place"),
        payload["package_id"],
        payload.get("custom_monthly_amount"),
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
                  place = %s,
                  package_id = %s,
                  custom_monthly_amount = %s,
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
                  place,
                  package_id,
                  custom_monthly_amount,
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
                UPDATE customers
                SET
                  assigned_user_id = %s,
                  updated_at = NOW()
                WHERE id = %s
                  AND is_active = TRUE
                RETURNING
                  id,
                  customer_name,
                  stb_number,
                  assigned_user_id,
                  updated_at
                """,
                (assigned_user_id, customer_id),
            )
            customer = cur.fetchone()
            conn.commit()
            return customer
