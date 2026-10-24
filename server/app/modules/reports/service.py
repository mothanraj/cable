from typing import Any

from app.config.database import get_connection


def get_billing_report(
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

    total_customers = len(records)
    total_billed = sum(float(row["monthly_amount"] or 0) for row in records)
    total_collected = sum(float(row["total_paid"] or 0) for row in records)
    total_outstanding = sum(
        float(row["balance_amount"] or 0) for row in records
    )
    paid_count = sum(1 for row in records if row["payment_status"] == "PAID")
    partial_count = sum(
        1 for row in records if row["payment_status"] == "PARTIAL"
    )
    unpaid_count = sum(
        1 for row in records if row["payment_status"] == "UNPAID"
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
        },
        "records": records,
    }
