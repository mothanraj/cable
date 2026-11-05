from typing import Any

from app.config.database import get_connection


def _build_report(records: list[dict[str, Any]]) -> dict[str, Any]:
    effective = [r for r in records if r.get("is_effective", True)]
    total_customers = len(effective)
    total_billed = sum(float(r["due_amount"] or 0) for r in effective)
    total_collected = sum(float(r["total_paid"] or 0) for r in effective)
    total_outstanding = sum(
        float(r["balance_amount"] or 0) for r in effective
    )
    paid_count = sum(1 for r in effective if r["payment_status"] == "PAID")
    partial_count = sum(
        1 for r in effective if r["payment_status"] == "PARTIAL"
    )
    unpaid_count = sum(
        1 for r in effective if r["payment_status"] == "UNPAID"
    )
    overpaid_count = sum(
        1 for r in effective if r["payment_status"] == "OVERPAID"
    )

    return {
        "summary": {
            "totalCustomers": total_customers,
            "totalBilled": total_billed,
            "totalCollected": total_collected,
            "totalOutstanding": total_outstanding,
            "paidCount": paid_count,
            "partialCount": partial_count,
            "unpaidCount": unpaid_count,
            "overpaidCount": overpaid_count,
        },
        "records": records,
    }


def _get_billing_report_by_month(
    *,
    user_id: str,
    role: str,
    billing_month: str | None = None,
) -> dict[str, Any]:
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
                  cbs.is_effective,
                  cbs.total_paid,
                  cbs.balance_amount,
                  cbs.payment_status
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
            records = cur.fetchall()

    return _build_report(records)


def _get_billing_report_by_date_range(
    *,
    user_id: str,
    role: str,
    from_date: str,
    to_date: str,
) -> dict[str, Any]:
    values: list[Any] = [from_date, to_date, from_date, to_date]
    where_sql = ""

    if role != "ADMIN":
        values.append(user_id)
        where_sql = "WHERE c.assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                WITH range_payments AS (
                  SELECT
                    p.billing_id,
                    SUM(p.collected_amount) AS total_paid,
                    COUNT(p.id)::int AS payment_count,
                    MAX(p.payment_date) AS last_payment_date
                  FROM payments p
                  WHERE p.payment_date >= %s::date
                    AND p.payment_date <= %s::date
                  GROUP BY p.billing_id
                ),
                bill_scope AS (
                  SELECT mb.id
                  FROM monthly_billing mb
                  WHERE mb.billing_month >= DATE_TRUNC('month', %s::date)::date
                    AND mb.billing_month <= DATE_TRUNC('month', %s::date)::date

                  UNION

                  SELECT rp.billing_id
                  FROM range_payments rp
                )
                SELECT
                  mb.id AS billing_id,
                  mb.customer_id,
                  c.customer_name,
                  c.stb_number,
                  c.phone,
                  c.place,
                  c.assigned_user_id,
                  u.username AS assigned_username,
                  u.full_name AS assigned_user_name,
                  mb.billing_month,
                  mb.package_name,
                  mb.monthly_amount,
                  mb.arrears_amount,
                  mb.monthly_amount + mb.arrears_amount AS due_amount,
                  (mb.rolled_forward_to_billing_id IS NULL) AS is_effective,
                  COALESCE(rp.total_paid, 0) AS total_paid,
                  GREATEST(
                    mb.monthly_amount + mb.arrears_amount
                    - COALESCE(rp.total_paid, 0),
                    0
                  ) AS balance_amount,
                  CASE
                    WHEN COALESCE(rp.total_paid, 0) = 0
                      THEN 'UNPAID'
                    WHEN COALESCE(rp.total_paid, 0)
                         < mb.monthly_amount + mb.arrears_amount
                      THEN 'PARTIAL'
                    WHEN COALESCE(rp.total_paid, 0)
                         > mb.monthly_amount + mb.arrears_amount
                      THEN 'OVERPAID'
                    ELSE 'PAID'
                  END AS payment_status,
                  COALESCE(rp.payment_count, 0) AS payment_count,
                  rp.last_payment_date
                FROM monthly_billing mb
                INNER JOIN bill_scope bs
                  ON bs.id = mb.id
                INNER JOIN customers c
                  ON c.id = mb.customer_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                LEFT JOIN range_payments rp
                  ON rp.billing_id = mb.id
                {where_sql}
                ORDER BY
                  mb.billing_month DESC,
                  c.customer_name ASC
                """,
                values,
            )
            records = cur.fetchall()

    return _build_report(records)


def get_billing_report(
    *,
    user_id: str,
    role: str,
    billing_month: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict[str, Any]:
    if from_date and to_date:
        return _get_billing_report_by_date_range(
            user_id=user_id,
            role=role,
            from_date=from_date,
            to_date=to_date,
        )

    return _get_billing_report_by_month(
        user_id=user_id,
        role=role,
        billing_month=billing_month,
    )
