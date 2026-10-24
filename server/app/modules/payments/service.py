from typing import Any

from app.config.database import get_connection


def get_payments(
    *,
    user_id: str,
    role: str,
    billing_id: str | None = None,
) -> list[dict[str, Any]]:
    values: list[Any] = []
    conditions: list[str] = []

    if billing_id:
        values.append(billing_id)
        conditions.append("p.billing_id = %s")

    if role != "ADMIN":
        values.append(user_id)
        conditions.append("c.assigned_user_id = %s")

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  p.id,
                  p.billing_id,
                  mb.customer_id,
                  c.customer_name,
                  c.stb_number,
                  c.phone,
                  c.place,
                  c.assigned_user_id,
                  assigned_user.username AS assigned_username,
                  assigned_user.full_name AS assigned_user_name,
                  mb.billing_month,
                  mb.package_name,
                  mb.monthly_amount,
                  p.payment_date,
                  p.collected_amount,
                  p.remarks,
                  p.created_by,
                  creator.username AS created_by_username,
                  creator.full_name AS created_by_name,
                  p.created_at,
                  p.updated_at
                FROM payments p
                INNER JOIN monthly_billing mb
                  ON mb.id = p.billing_id
                INNER JOIN customers c
                  ON c.id = mb.customer_id
                INNER JOIN users assigned_user
                  ON assigned_user.id = c.assigned_user_id
                INNER JOIN users creator
                  ON creator.id = p.created_by
                {where_sql}
                ORDER BY
                  p.payment_date DESC,
                  p.created_at DESC
                """,
                values,
            )
            return cur.fetchall()


def get_payment_by_id(
    *,
    payment_id: str,
    user_id: str,
    role: str,
) -> dict[str, Any] | None:
    values: list[Any] = [payment_id]
    ownership = ""

    if role != "ADMIN":
        values.append(user_id)
        ownership = "AND c.assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  p.id,
                  p.billing_id,
                  mb.customer_id,
                  c.customer_name,
                  c.stb_number,
                  c.phone,
                  c.place,
                  c.assigned_user_id,
                  assigned_user.username AS assigned_username,
                  assigned_user.full_name AS assigned_user_name,
                  mb.billing_month,
                  mb.package_name,
                  mb.monthly_amount,
                  p.payment_date,
                  p.collected_amount,
                  p.remarks,
                  p.created_by,
                  creator.username AS created_by_username,
                  creator.full_name AS created_by_name,
                  p.created_at,
                  p.updated_at
                FROM payments p
                INNER JOIN monthly_billing mb
                  ON mb.id = p.billing_id
                INNER JOIN customers c
                  ON c.id = mb.customer_id
                INNER JOIN users assigned_user
                  ON assigned_user.id = c.assigned_user_id
                INNER JOIN users creator
                  ON creator.id = p.created_by
                WHERE p.id = %s
                  {ownership}
                """,
                values,
            )
            return cur.fetchone()


def create_payment(
    *,
    billing_id: str,
    payment_date: str,
    collected_amount: float,
    remarks: str | None,
    user_id: str,
    role: str,
) -> dict[str, Any] | None:
    billing_values: list[Any] = [billing_id]
    ownership = ""

    if role != "ADMIN":
        billing_values.append(user_id)
        ownership = "AND c.assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  mb.id,
                  mb.customer_id,
                  mb.monthly_amount
                FROM monthly_billing mb
                INNER JOIN customers c
                  ON c.id = mb.customer_id
                WHERE mb.id = %s
                  AND c.is_active = TRUE
                  {ownership}
                """,
                billing_values,
            )
            billing = cur.fetchone()

            if billing is None:
                return None

            cur.execute(
                """
                INSERT INTO payments (
                  billing_id,
                  payment_date,
                  collected_amount,
                  remarks,
                  created_by
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING
                  id,
                  billing_id,
                  payment_date,
                  collected_amount,
                  remarks,
                  created_by,
                  created_at,
                  updated_at
                """,
                (
                    billing_id,
                    payment_date,
                    collected_amount,
                    remarks,
                    user_id,
                ),
            )
            payment = cur.fetchone()
            conn.commit()
            return payment
