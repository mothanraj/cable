"""Shared SQL building blocks for the admin "collector" filter.

A collector is the user who recorded a payment (``payments.created_by``).
When an admin picks a collector, monetary values are recomputed from only
that user's payments so that cards, tables and exports stay consistent.
"""

import re

from app.utils.errors import AppError

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}"
    r"-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def validate_user_id(value: str | None) -> None:
    if value and not UUID_RE.match(value):
        raise AppError(
            code="INVALID_USER_ID",
            message="User must be a valid user id.",
            status_code=400,
        )


def validate_collector_user_id(value: str | None) -> None:
    validate_user_id(value)


def _indent(sql: str) -> str:
    return "\n".join(f"  {line.strip()}" for line in sql.strip().splitlines())


def collector_paid_join(billing_id_expr: str) -> str:
    """Left join with the selected collector's payments for one bill.

    Caller must append the collector id to the query values before the
    values belonging to the WHERE clause.
    """
    return f"""
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(p.collected_amount), 0) AS total_paid,
          COUNT(p.id)::int AS payment_count,
          MAX(p.payment_date) AS last_payment_date
        FROM payments p
        WHERE p.billing_id = {billing_id_expr}
          AND p.created_by = %s
      ) cp ON TRUE
    """


def collector_amount_columns(
    *,
    due_expr: str,
    credit_balance_expr: str,
    credit_adjustment_expr: str,
) -> str:
    """Payment-derived columns recomputed from the collector join ``cp``."""
    paid = "COALESCE(cp.total_paid, 0)"
    due = f"GREATEST({due_expr}, 0)"
    return f"""
      {paid} AS total_paid,
      GREATEST({due} - {paid}, 0) AS balance_amount,
      CASE
        WHEN {paid} = 0 AND {due} > 0 THEN 'UNPAID'
        WHEN {paid} > {due} THEN 'OVERPAID'
        WHEN {paid} < {due} THEN 'PARTIAL'
        ELSE 'PAID'
      END AS payment_status,
      GREATEST({paid} - {due}, 0)
        + {credit_balance_expr}
        + {credit_adjustment_expr} AS credit_available,
      COALESCE(cp.payment_count, 0) AS payment_count,
      cp.last_payment_date
    """


COLLECTOR_SCOPED_FIELDS = (
    "total_paid",
    "balance_amount",
    "payment_status",
    "credit_available",
)


def scoped_billing_select(
    base_select: str,
    *,
    due_expr: str,
    credit_balance_expr: str,
    credit_adjustment_expr: str,
    table_alias: str = "cbs",
) -> str:
    """Replace payment-derived columns of a billing SELECT with scoped ones."""
    hidden = {
        f"{table_alias}.{field}" for field in COLLECTOR_SCOPED_FIELDS
    }
    kept: list[str] = []

    for line in base_select.strip().splitlines():
        stripped = line.strip().rstrip(",")
        if not stripped or stripped in hidden:
            continue
        kept.append(f"  {stripped}")

    scoped = collector_amount_columns(
        due_expr=due_expr,
        credit_balance_expr=credit_balance_expr,
        credit_adjustment_expr=credit_adjustment_expr,
    )
    return ",\n".join(kept) + ",\n" + _indent(scoped)


def collector_billing_exists(billing_id_expr: str) -> str:
    """Condition: the bill has at least one payment by the collector."""
    return (
        "EXISTS (SELECT 1 FROM payments p "
        f"WHERE p.billing_id = {billing_id_expr} AND p.created_by = %s)"
    )


def collector_customer_exists(customer_id_expr: str) -> str:
    """Condition: the customer has at least one payment by the collector."""
    return (
        "EXISTS (SELECT 1 FROM payments p "
        "INNER JOIN monthly_billing mb ON mb.id = p.billing_id "
        f"WHERE mb.customer_id = {customer_id_expr} "
        "AND p.created_by = %s)"
    )
