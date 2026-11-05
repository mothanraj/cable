from typing import Any

from app.config.database import get_connection


def get_dashboard(
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
    summary_where_sql = (
        f"{where_sql} AND cbs.is_effective = TRUE"
        if where_sql
        else "WHERE cbs.is_effective = TRUE"
    )

    customer_values: list[Any] = []
    customer_conditions = ["c.is_active = TRUE"]

    if role != "ADMIN":
        customer_values.append(user_id)
        customer_conditions.append("c.assigned_user_id = %s")

    customer_where = " AND ".join(customer_conditions)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  COUNT(*) AS total_customers
                FROM customers c
                WHERE {customer_where}
                """,
                customer_values,
            )
            customer_summary = cur.fetchone()

            cur.execute(
                f"""
                SELECT
                  COALESCE(SUM(cbs.due_amount), 0) AS total_billed,
                  COALESCE(SUM(cbs.total_paid), 0) AS total_collected,
                  COALESCE(SUM(cbs.balance_amount), 0) AS total_outstanding,
                  COUNT(
                    CASE
                      WHEN cbs.payment_status = 'PAID'
                      THEN 1
                    END
                  ) AS paid_count,
                  COUNT(
                    CASE
                      WHEN cbs.payment_status = 'PARTIAL'
                      THEN 1
                    END
                  ) AS partial_count,
                  COUNT(
                    CASE
                      WHEN cbs.payment_status = 'UNPAID'
                      THEN 1
                    END
                  ) AS unpaid_count,
                  COUNT(
                    CASE
                      WHEN cbs.payment_status = 'OVERPAID'
                      THEN 1
                    END
                  ) AS overpaid_count
                FROM customer_billing_summary cbs
                INNER JOIN customers c
                  ON c.id = cbs.customer_id
                {summary_where_sql}
                """,
                values,
            )
            summary = cur.fetchone()

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
            billing = cur.fetchall()

            payment_values: list[Any] = []
            payment_conditions: list[str] = []

            if billing_month:
                payment_values.append(billing_month)
                payment_conditions.append("mb.billing_month = %s")

            if role != "ADMIN":
                payment_values.append(user_id)
                payment_conditions.append("c.assigned_user_id = %s")

            payment_where = (
                f"WHERE {' AND '.join(payment_conditions)}"
                if payment_conditions
                else ""
            )

            cur.execute(
                f"""
                SELECT
                  p.id,
                  p.billing_id,
                  mb.customer_id,
                  c.customer_name,
                  c.stb_number,
                  mb.billing_month,
                  mb.package_name,
                  mb.monthly_amount,
                  p.payment_date,
                  p.collected_amount,
                  p.remarks,
                  creator.username AS created_by_username,
                  creator.full_name AS created_by_name,
                  p.created_at
                FROM payments p
                INNER JOIN monthly_billing mb
                  ON mb.id = p.billing_id
                INNER JOIN customers c
                  ON c.id = mb.customer_id
                INNER JOIN users creator
                  ON creator.id = p.created_by
                {payment_where}
                ORDER BY
                  p.payment_date DESC,
                  p.created_at DESC
                LIMIT 10
                """,
                payment_values,
            )
            recent_payments = cur.fetchall()

    return {
        "summary": {
            "totalCustomers": int(
                customer_summary["total_customers"] or 0
            ),
            "totalBilled": float(summary["total_billed"] or 0),
            "totalCollected": float(summary["total_collected"] or 0),
            "totalOutstanding": float(summary["total_outstanding"] or 0),
            "paidCount": int(summary["paid_count"] or 0),
            "partialCount": int(summary["partial_count"] or 0),
            "unpaidCount": int(summary["unpaid_count"] or 0),
            "overpaidCount": int(summary["overpaid_count"] or 0),
        },
        "billing": billing,
        "recentPayments": recent_payments,
    }
