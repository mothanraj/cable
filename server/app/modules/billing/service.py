from typing import Any

from app.config.database import get_connection

BILLING_SUMMARY_SELECT = """
  cbs.billing_id AS id,
  cbs.billing_id,
  cbs.customer_id,
  c.customer_name,
  c.stb_number,
  c.phone,
  c.place,
  c.assigned_user_id,
  u.username AS assigned_username,
  u.full_name AS assigned_user_name,
  cbs.billing_month,
  cbs.package_name,
  cbs.monthly_amount,
  cbs.total_paid,
  cbs.balance_amount,
  cbs.payment_status
"""


def get_billing(
    *,
    user_id: str,
    role: str,
    billing_month: str | None = None,
) -> list[dict[str, Any]]:
    values: list[Any] = []
    conditions: list[str] = []

    if billing_month:
        values.append(billing_month)
        conditions.append("cbs.billing_month = %s")

    if role != "ADMIN":
        values.append(user_id)
        conditions.append("c.assigned_user_id = %s")

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  {BILLING_SUMMARY_SELECT}
                FROM customer_billing_summary cbs
                INNER JOIN customers c
                  ON c.id = cbs.customer_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                {where_sql}
                ORDER BY
                  cbs.billing_month DESC,
                  c.customer_name ASC
                """,
                values,
            )
            return cur.fetchall()


def get_billing_by_id(
    *,
    billing_id: str,
    user_id: str,
    role: str,
) -> dict[str, Any] | None:
    values: list[Any] = [billing_id]
    ownership = ""

    if role != "ADMIN":
        values.append(user_id)
        ownership = "AND c.assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  {BILLING_SUMMARY_SELECT}
                FROM customer_billing_summary cbs
                INNER JOIN customers c
                  ON c.id = cbs.customer_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                WHERE cbs.billing_id = %s
                  {ownership}
                """,
                values,
            )
            return cur.fetchone()


def _get_billing_summary_by_id(billing_id: Any) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  {BILLING_SUMMARY_SELECT}
                FROM customer_billing_summary cbs
                INNER JOIN customers c
                  ON c.id = cbs.customer_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                WHERE cbs.billing_id = %s
                """,
                (billing_id,),
            )
            return cur.fetchone()


def generate_billing(
    *,
    customer_id: str,
    billing_month: str,
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
                  c.custom_monthly_amount,
                  p.package_name,
                  p.monthly_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                WHERE c.id = %s
                  AND c.is_active = TRUE
                  AND p.is_active = TRUE
                  {ownership}
                """,
                values,
            )
            customer = cur.fetchone()

            if customer is None:
                return None

            effective_amount = (
                customer["custom_monthly_amount"]
                if customer["custom_monthly_amount"] is not None
                else customer["monthly_amount"]
            )

            cur.execute(
                """
                INSERT INTO monthly_billing (
                  customer_id,
                  billing_month,
                  package_name,
                  monthly_amount
                )
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (
                    customer_id,
                    billing_month,
                    customer["package_name"],
                    effective_amount,
                ),
            )
            inserted = cur.fetchone()
            conn.commit()

    return _get_billing_summary_by_id(inserted["id"])
