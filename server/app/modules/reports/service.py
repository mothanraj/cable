from typing import Any

from app.config.database import get_connection
from app.utils.collector_scope import (
    collector_billing_exists,
    collector_paid_join,
    scoped_billing_select,
    validate_collector_user_id,
)

MONTH_REPORT_SELECT = """
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
"""


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
    collector_user_id: str | None = None,
) -> dict[str, Any]:
    values: list[Any] = []
    conditions: list[str] = []
    collector_join = ""
    select = MONTH_REPORT_SELECT

    if role == "ADMIN" and collector_user_id:
        # Placeholder order: lateral join, then WHERE conditions.
        values.append(collector_user_id)
        collector_join = collector_paid_join("cbs.billing_id")
        select = scoped_billing_select(
            MONTH_REPORT_SELECT,
            due_expr="cbs.due_amount",
            credit_balance_expr="cbs.credit_balance",
            credit_adjustment_expr="cbs.credit_adjustment",
        )
        values.append(collector_user_id)
        conditions.append(collector_billing_exists("cbs.billing_id"))

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
                  {select}
                FROM customer_billing_summary cbs
                INNER JOIN customers c
                  ON c.id = cbs.customer_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                {collector_join}
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
    collector_user_id: str | None = None,
) -> dict[str, Any]:
    scoped = role == "ADMIN" and bool(collector_user_id)
    values: list[Any] = [from_date, to_date]

    if scoped:
        # Payments counted toward the report are limited to this collector.
        values.append(collector_user_id)

    values.extend([from_date, to_date])
    collector_payment_sql = ""
    collector_bill_sql = ""

    if scoped:
        collector_payment_sql = "AND p.created_by = %s"
        collector_bill_sql = (
            "AND EXISTS (SELECT 1 FROM payments p "
            "WHERE p.billing_id = mb.id AND p.created_by = %s)"
        )
        values.append(collector_user_id)

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
                    {collector_payment_sql}
                  GROUP BY p.billing_id
                ),
                bill_scope AS (
                  SELECT mb.id
                  FROM monthly_billing mb
                  WHERE mb.billing_month >= DATE_TRUNC('month', %s::date)::date
                    AND mb.billing_month <= DATE_TRUNC('month', %s::date)::date
                    {collector_bill_sql}

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
                  mb.credit_applied,
                  mb.credit_balance,
                  mb.due_adjustment,
                  mb.credit_adjustment,
                  GREATEST(
                    mb.monthly_amount + mb.arrears_amount
                    - mb.credit_applied + mb.due_adjustment,
                    0
                  ) AS due_amount,
                  (mb.rolled_forward_to_billing_id IS NULL) AS is_effective,
                  COALESCE(rp.total_paid, 0) AS total_paid,
                  GREATEST(
                    GREATEST(
                      mb.monthly_amount + mb.arrears_amount
                      - mb.credit_applied + mb.due_adjustment,
                      0
                    ) - COALESCE(rp.total_paid, 0),
                    0
                  ) AS balance_amount,
                  CASE
                    WHEN COALESCE(rp.total_paid, 0) = 0
                      AND GREATEST(
                            mb.monthly_amount + mb.arrears_amount
                            - mb.credit_applied + mb.due_adjustment,
                            0
                          ) > 0
                      THEN 'UNPAID'
                    WHEN COALESCE(rp.total_paid, 0)
                         > GREATEST(
                             mb.monthly_amount + mb.arrears_amount
                             - mb.credit_applied + mb.due_adjustment,
                             0
                           )
                      THEN 'OVERPAID'
                    WHEN COALESCE(rp.total_paid, 0)
                         < GREATEST(
                             mb.monthly_amount + mb.arrears_amount
                             - mb.credit_applied + mb.due_adjustment,
                             0
                           )
                      THEN 'PARTIAL'
                    ELSE 'PAID'
                  END AS payment_status,
                  GREATEST(
                    COALESCE(rp.total_paid, 0)
                    - GREATEST(
                        mb.monthly_amount + mb.arrears_amount
                        - mb.credit_applied + mb.due_adjustment,
                        0
                      ),
                    0
                  ) + mb.credit_balance + mb.credit_adjustment
                    AS credit_available,
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
    collector_user_id: str | None = None,
) -> dict[str, Any]:
    validate_collector_user_id(collector_user_id)

    if from_date and to_date:
        return _get_billing_report_by_date_range(
            user_id=user_id,
            role=role,
            from_date=from_date,
            to_date=to_date,
            collector_user_id=collector_user_id,
        )

    return _get_billing_report_by_month(
        user_id=user_id,
        role=role,
        billing_month=billing_month,
        collector_user_id=collector_user_id,
    )
