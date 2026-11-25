from typing import Any

from app.config.database import get_connection
from app.modules.billing.reprice import reprice_outstanding_bills
from app.utils.collector_scope import (
    collector_customer_exists,
    validate_collector_user_id,
    validate_user_id,
)
from app.utils.errors import AppError

# A bill is "overdue" once its billing month has passed with money still
# owing, or when unpaid months were rolled forward into a newer bill.
OVERDUE_CONDITION = """
(
  {alias}.is_effective = TRUE
  AND {alias}.balance_amount > 0
  AND (
    {alias}.billing_month < date_trunc('month', CURRENT_DATE)::date
    OR {alias}.arrears_amount > 0
  )
)
"""


def _overdue_condition(alias: str = "cbs") -> str:
    return OVERDUE_CONDITION.format(alias=alias)


def sync_customer_statuses_with_cursor(cur) -> int:
    """Align customers.is_active with the monthly service rule.

    Paying a bill for month M keeps the connection active through the end
    of month M+1. A customer is deactivated when either:

    * an effective bill still has a balance and its month has passed (or it
      carries rolled-forward arrears), or
    * they have been billed before but have no bill for the current or the
      previous month - i.e. the collector skipped generating a new bill.

    A customer who has never been billed stays active until their first bill
    is generated. Only rows whose status actually changes are written.
    """
    overdue = _overdue_condition()

    any_bill = """
      EXISTS (
        SELECT 1 FROM monthly_billing mb0
        WHERE mb0.customer_id = c.id
      )
    """

    recent_bill = """
      EXISTS (
        SELECT 1 FROM monthly_billing mb
        WHERE mb.customer_id = c.id
          AND mb.rolled_forward_to_billing_id IS NULL
          AND mb.billing_month >=
              date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date
      )
    """

    cur.execute(
        f"""
        UPDATE customers c
        SET is_active = FALSE, updated_at = NOW()
        WHERE c.is_active = TRUE
          AND (
            EXISTS (
              SELECT 1 FROM customer_billing_summary cbs
              WHERE cbs.customer_id = c.id AND {overdue}
            )
            OR ({any_bill} AND NOT ({recent_bill}))
          )
        """
    )
    deactivated = cur.rowcount

    cur.execute(
        f"""
        UPDATE customers c
        SET is_active = TRUE, updated_at = NOW()
        WHERE c.is_active = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM customer_billing_summary cbs
            WHERE cbs.customer_id = c.id AND {overdue}
          )
          AND (NOT ({any_bill}) OR {recent_bill})
        """
    )
    reactivated = cur.rowcount

    return deactivated + reactivated


def sync_customer_statuses() -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            changed = sync_customer_statuses_with_cursor(cur)
        conn.commit()
    return changed


def get_overdue_bills_with_cursor(
    cur, customer_id: str
) -> list[dict[str, Any]]:
    """Past-month bills that still carry a balance, oldest first.

    Mirrors the `OVERDUE_CONDITION` used by the status sync so paying the
    reported total always clears the customer's deactivation.
    """
    # Read through the summary view so credits, adjustments and the shared
    # overdue definition are always in sync with the customer status sync.
    cur.execute(
        f"""
        SELECT
          cbs.billing_id AS id,
          cbs.billing_month,
          cbs.balance_amount
        FROM customer_billing_summary cbs
        WHERE cbs.customer_id = %s
          AND {_overdue_condition()}
        ORDER BY cbs.billing_month ASC
        """,
        (customer_id,),
    )

    return [
        {
            "id": row["id"],
            "billing_month": row["billing_month"],
            "balance": row["balance_amount"],
        }
        for row in cur.fetchall()
    ]


def get_customer_arrears_with_cursor(
    cur, customer_id: str
) -> dict[str, Any]:
    bills = get_overdue_bills_with_cursor(cur, customer_id)

    return {
        "amount": sum((bill["balance"] for bill in bills), 0),
        "bills": len(bills),
        "oldest_month": bills[0]["billing_month"] if bills else None,
    }


def get_customer_status_summary(
    *,
    user_id: str | None = None,
    role: str = "ADMIN",
    collector_user_id: str | None = None,
) -> dict[str, Any]:
    validate_collector_user_id(collector_user_id)

    values: list[Any] = []
    conditions: list[str] = []

    if role != "ADMIN" and user_id:
        values.append(user_id)
        conditions.append("c.assigned_user_id = %s")

    if role == "ADMIN" and collector_user_id:
        values.append(collector_user_id)
        conditions.append(collector_customer_exists("c.id"))

    scope = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    overdue = _overdue_condition()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  COUNT(*) AS total_customers,
                  COUNT(*) FILTER (WHERE c.is_active) AS active_customers,
                  COUNT(*) FILTER (WHERE NOT c.is_active) AS deactivated_customers,
                  COALESCE(SUM(bal.overdue_amount), 0) AS overdue_balance
                FROM customers c
                LEFT JOIN (
                  SELECT
                    cbs.customer_id,
                    SUM(cbs.balance_amount) FILTER (WHERE {overdue}) AS overdue_amount
                  FROM customer_billing_summary cbs
                  GROUP BY cbs.customer_id
                ) bal ON bal.customer_id = c.id
                {scope}
                """,
                values,
            )
            return cur.fetchone()


def get_customers(
    *,
    user_id: str,
    role: str,
    search: str | None = None,
    collector_user_id: str | None = None,
) -> list[dict[str, Any]]:
    validate_collector_user_id(collector_user_id)

    values: list[Any] = []
    conditions: list[str] = []

    if role != "ADMIN":
        values.append(user_id)
        conditions.append(f"c.assigned_user_id = %s")

    if role == "ADMIN" and collector_user_id:
        values.append(collector_user_id)
        conditions.append(collector_customer_exists("c.id"))

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

    where_sql = (
        f"WHERE {' AND '.join(conditions)}" if conditions else ""
    )

    overdue = _overdue_condition()
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
                  COALESCE(op.overpaid_amount, 0) AS overpaid_amount,
                  COALESCE(bal.outstanding_balance, 0) AS outstanding_balance,
                  COALESCE(bal.overdue_amount, 0) AS overdue_amount,
                  bal.overdue_month,
                  overdue.billing_id AS overdue_billing_id,
                  overdue.billing_month AS overdue_billing_month,
                  overdue.monthly_amount AS overdue_monthly_amount,
                  overdue.total_paid AS overdue_total_paid,
                  overdue.balance_amount AS overdue_balance_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                LEFT JOIN (
                  SELECT
                    cbs.customer_id,
                    SUM(cbs.credit_available) AS overpaid_amount
                  FROM customer_billing_summary cbs
                  WHERE cbs.is_effective = TRUE
                  GROUP BY cbs.customer_id
                ) op
                  ON op.customer_id = c.id
                LEFT JOIN (
                  SELECT
                    cbs.customer_id,
                    SUM(cbs.balance_amount) FILTER (WHERE cbs.is_effective = TRUE) AS outstanding_balance,
                    SUM(cbs.balance_amount) FILTER (WHERE {overdue}) AS overdue_amount,
                    MIN(cbs.billing_month) FILTER (WHERE {overdue}) AS overdue_month
                  FROM customer_billing_summary cbs
                  GROUP BY cbs.customer_id
                ) bal
                  ON bal.customer_id = c.id
                LEFT JOIN LATERAL (
                  SELECT
                    cbs.billing_id,
                    cbs.billing_month,
                    cbs.monthly_amount,
                    cbs.total_paid,
                    cbs.balance_amount
                  FROM customer_billing_summary cbs
                  WHERE cbs.customer_id = c.id AND {overdue}
                  ORDER BY cbs.billing_month ASC
                  LIMIT 1
                ) overdue ON TRUE
                {where_sql}
                ORDER BY
                  c.assigned_user_id ASC,
                  c.place_id ASC NULLS LAST,
                  c.display_order ASC,
                  c.customer_name ASC
                """,
                values,
            )
            return cur.fetchall()


def get_customers_report(
    *,
    search: str | None = None,
    place_id: str | None = None,
    package_id: str | None = None,
    include_inactive: bool = True,
    assigned_user_id: str | None = None,
) -> list[dict[str, Any]]:
    """Admin customer directory: every customer, all details.

    Supports free-text search (name / STB / phone / place) plus place,
    package and assigned-user filters. Billing and payment activity are
    deliberately not required: a customer with no generated bill is still
    part of the directory. Inactive customers are included by default.
    """
    validate_user_id(assigned_user_id)

    values: list[Any] = []
    conditions: list[str] = []

    if not include_inactive:
        conditions.append("c.is_active = TRUE")

    if assigned_user_id:
        values.append(assigned_user_id)
        conditions.append("c.assigned_user_id = %s")

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        values.extend([pattern, pattern, pattern, pattern])
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

    if place_id:
        values.append(place_id)
        conditions.append("c.place_id = %s")

    if package_id:
        values.append(package_id)
        conditions.append("c.package_id = %s")

    where_sql = (
        f"WHERE {' AND '.join(conditions)}" if conditions else ""
    )

    overdue = _overdue_condition()
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
                  pl.place_name,
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
                  COALESCE(op.overpaid_amount, 0) AS overpaid_amount,
                  COALESCE(bal.outstanding_balance, 0) AS outstanding_balance,
                  COALESCE(bal.overdue_amount, 0) AS overdue_amount,
                  bal.overdue_month,
                  overdue.billing_id AS overdue_billing_id,
                  overdue.billing_month AS overdue_billing_month,
                  overdue.monthly_amount AS overdue_monthly_amount,
                  overdue.total_paid AS overdue_total_paid,
                  overdue.balance_amount AS overdue_balance_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                INNER JOIN users u
                  ON u.id = c.assigned_user_id
                LEFT JOIN places pl
                  ON pl.id = c.place_id
                LEFT JOIN (
                  SELECT
                    cbs.customer_id,
                    SUM(cbs.credit_available) AS overpaid_amount
                  FROM customer_billing_summary cbs
                  WHERE cbs.is_effective = TRUE
                  GROUP BY cbs.customer_id
                ) op
                  ON op.customer_id = c.id
                LEFT JOIN (
                  SELECT
                    cbs.customer_id,
                    SUM(cbs.balance_amount) FILTER (WHERE cbs.is_effective = TRUE) AS outstanding_balance,
                    SUM(cbs.balance_amount) FILTER (WHERE {overdue}) AS overdue_amount,
                    MIN(cbs.billing_month) FILTER (WHERE {overdue}) AS overdue_month
                  FROM customer_billing_summary cbs
                  GROUP BY cbs.customer_id
                ) bal
                  ON bal.customer_id = c.id
                LEFT JOIN LATERAL (
                  SELECT
                    cbs.billing_id,
                    cbs.billing_month,
                    cbs.monthly_amount,
                    cbs.total_paid,
                    cbs.balance_amount
                  FROM customer_billing_summary cbs
                  WHERE cbs.customer_id = c.id AND {overdue}
                  ORDER BY cbs.billing_month ASC
                  LIMIT 1
                ) overdue ON TRUE
                {where_sql}
                ORDER BY
                  c.is_active DESC,
                  u.full_name ASC NULLS LAST,
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
            old_values: list[Any] = [customer_id]
            old_ownership = ""

            if role != "ADMIN":
                old_values.append(user_id)
                old_ownership = "AND assigned_user_id = %s"

            cur.execute(
                f"""
                SELECT package_id::text AS package_id
                FROM customers
                WHERE id = %s
                  {old_ownership}
                """,
                old_values,
            )
            old = cur.fetchone()

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

            repriced = 0
            if old and str(old["package_id"]) != str(payload["package_id"]):
                cur.execute(
                    """
                    SELECT package_name, monthly_amount
                    FROM packages
                    WHERE id = %s
                    """,
                    (payload["package_id"],),
                )
                new_package = cur.fetchone()

                if new_package:
                    repriced = reprice_outstanding_bills(
                        cur,
                        [customer_id],
                        new_package["package_name"],
                        new_package["monthly_amount"],
                    )
                    sync_customer_statuses_with_cursor(cur)

            conn.commit()
            return {**customer, "repricedBills": repriced}


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
