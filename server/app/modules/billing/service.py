from decimal import Decimal
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
  cbs.arrears_amount,
  cbs.due_amount,
  cbs.rolled_forward_to_billing_id,
  cbs.is_effective,
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


def _previous_overpaid(cur: Any, customer_id: str) -> dict[str, Any]:
    cur.execute(
        """
        SELECT
          COALESCE(SUM(GREATEST(cbs.total_paid - cbs.due_amount, 0)), 0)
            AS amount,
          COUNT(*) FILTER (
            WHERE cbs.total_paid > cbs.due_amount
          ) AS bills
        FROM customer_billing_summary cbs
        WHERE cbs.customer_id = %s
          AND cbs.is_effective = TRUE
        """,
        (customer_id,),
    )
    row = cur.fetchone()
    return {
        "amount": float(row["amount"] or 0),
        "bills": int(row["bills"] or 0),
    }


def _roll_forward_unpaid(
    cur: Any,
    customer_id: str,
) -> tuple[Any, list[Any]]:
    # Lock the bills to roll forward first, without an aggregate.
    cur.execute(
        """
        SELECT
          mb.id,
          mb.monthly_amount + mb.arrears_amount AS due_amount
        FROM monthly_billing mb
        WHERE mb.customer_id = %s
          AND mb.rolled_forward_to_billing_id IS NULL
        ORDER BY mb.billing_month, mb.id
        FOR UPDATE OF mb
        """,
        (customer_id,),
    )
    bills = cur.fetchall()

    if not bills:
        return Decimal("0"), []

    ids = [row["id"] for row in bills]

    # Sum payments per bill in a separate, valid aggregate query.
    cur.execute(
        """
        SELECT billing_id, COALESCE(SUM(collected_amount), 0) AS total_paid
        FROM payments
        WHERE billing_id = ANY(%s)
        GROUP BY billing_id
        """,
        (ids,),
    )
    paid_map = {
        row["billing_id"]: row["total_paid"]
        for row in cur.fetchall()
    }

    arrears = Decimal("0")
    source_ids: list[Any] = []

    for row in bills:
        outstanding = row["due_amount"] - paid_map.get(
            row["id"],
            Decimal("0"),
        )

        if outstanding and outstanding > 0:
            arrears += outstanding
            source_ids.append(row["id"])

    return arrears, source_ids


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
                  p.package_name,
                  p.monthly_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                WHERE c.id = %s
                  AND c.is_active = TRUE
                  {ownership}
                """,
                values,
            )
            customer = cur.fetchone()

            if customer is None:
                return None

            arrears, source_ids = _roll_forward_unpaid(
                cur,
                customer_id,
            )

            effective_amount = customer["monthly_amount"]

            cur.execute(
                """
                INSERT INTO monthly_billing (
                  customer_id,
                  billing_month,
                  package_name,
                  monthly_amount,
                  arrears_amount
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    customer_id,
                    billing_month,
                    customer["package_name"],
                    effective_amount,
                    arrears,
                ),
            )
            inserted = cur.fetchone()

            if source_ids:
                cur.execute(
                    """
                    UPDATE monthly_billing
                    SET rolled_forward_to_billing_id = %s
                    WHERE id = ANY(%s)
                    """,
                    (inserted["id"], source_ids),
                )

            overpaid = _previous_overpaid(cur, customer_id)
            conn.commit()

    billing = _get_billing_summary_by_id(inserted["id"])
    return {"billing": billing, "previousOverpaid": overpaid}


def generate_billing_bulk(
    *,
    customer_ids: list[str],
    billing_month: str,
    user_id: str,
    role: str,
) -> dict[str, list[dict[str, Any]]]:
    unique_ids = list(dict.fromkeys(str(cid) for cid in customer_ids))

    generated: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []

    if not unique_ids:
        return {
            "generated": generated,
            "skipped": skipped,
            "failed": failed,
        }

    values: list[Any] = [unique_ids]
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
                  p.package_name,
                  p.monthly_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                WHERE c.id = ANY(%s)
                  AND c.is_active = TRUE
                  {ownership}
                """,
                values,
            )
            customers = {
                str(row["id"]): row for row in cur.fetchall()
            }

            cur.execute(
                """
                SELECT customer_id
                FROM monthly_billing
                WHERE billing_month = %s
                  AND customer_id = ANY(%s)
                """,
                (billing_month, unique_ids),
            )
            already_billed = {
                str(row["customer_id"]) for row in cur.fetchall()
            }

            for cid in unique_ids:
                if cid not in customers:
                    failed.append(
                        {
                            "customerId": cid,
                            "message": (
                                "Customer not found or you "
                                "do not have permission."
                            ),
                        }
                    )
                elif cid in already_billed:
                    row = customers[cid]
                    skipped.append(
                        {
                            "customerId": cid,
                            "customerName": row["customer_name"],
                            "stbNumber": row["stb_number"],
                        }
                    )

            to_insert = [
                cid
                for cid in unique_ids
                if cid in customers and cid not in already_billed
            ]

            for cid in to_insert:
                row = customers[cid]
                arrears, source_ids = _roll_forward_unpaid(
                    cur,
                    cid,
                )

                cur.execute(
                    """
                    INSERT INTO monthly_billing (
                      customer_id,
                      billing_month,
                      package_name,
                      monthly_amount,
                      arrears_amount
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        cid,
                        billing_month,
                        row["package_name"],
                        row["monthly_amount"],
                        arrears,
                    ),
                )
                inserted = cur.fetchone()

                if source_ids:
                    cur.execute(
                        """
                        UPDATE monthly_billing
                        SET rolled_forward_to_billing_id = %s
                        WHERE id = ANY(%s)
                        """,
                        (inserted["id"], source_ids),
                    )

                overpaid = _previous_overpaid(cur, cid)

                generated.append(
                    {
                        "customerId": cid,
                        "customerName": row["customer_name"],
                        "stbNumber": row["stb_number"],
                        "arrearsAmount": float(arrears or 0),
                        "previousOverpaid": overpaid,
                    }
                )

            conn.commit()

    return {
        "generated": generated,
        "skipped": skipped,
        "failed": failed,
    }
