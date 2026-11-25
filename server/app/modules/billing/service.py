from decimal import Decimal
from typing import Any

from app.config.database import get_connection
from app.modules.customers.service import (
    sync_customer_statuses_with_cursor,
)
from app.utils.collector_scope import (
    collector_billing_exists,
    collector_paid_join,
    scoped_billing_select,
    validate_collector_user_id,
)
from app.utils.errors import AppError

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
  cbs.credit_applied,
  cbs.credit_balance,
  cbs.due_adjustment,
  cbs.credit_adjustment,
  cbs.credit_available,
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
    collector_user_id: str | None = None,
) -> list[dict[str, Any]]:
    validate_collector_user_id(collector_user_id)

    values: list[Any] = []
    conditions: list[str] = []

    scoped = role == "ADMIN" and bool(collector_user_id)
    collector_join = ""
    select = BILLING_SUMMARY_SELECT

    if scoped:
        # The lateral join placeholder comes before the WHERE placeholders.
        values.append(collector_user_id)
        collector_join = collector_paid_join("cbs.billing_id")
        select = scoped_billing_select(
            BILLING_SUMMARY_SELECT,
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


def _collect_carry_forward(
    cur: Any,
    customer_id: str,
) -> tuple[Any, list[Any], Any, int]:
    """Gather everything the next bill must carry forward.

    Returns ``(arrears, source_ids, credit, credit_bills)``. Every effective
    bill is folded into the new bill, including fully paid ones that hold an
    unused overpayment credit. That keeps a single effective bill per
    customer and prevents the same credit from being applied twice.
    """
    # Lock the effective bills first, without an aggregate or view join.
    cur.execute(
        """
        SELECT
          mb.id,
          mb.monthly_amount + mb.arrears_amount
            - mb.credit_applied + mb.due_adjustment
            AS due_amount
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
        return Decimal("0"), [], Decimal("0"), 0

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

    cur.execute(
        """
        SELECT billing_id, credit_available
        FROM customer_billing_summary
        WHERE billing_id = ANY(%s)
          AND credit_available > 0
        """,
        (ids,),
    )
    credit_map = {
        row["billing_id"]: row["credit_available"]
        for row in cur.fetchall()
    }

    arrears = Decimal("0")
    credit = Decimal("0")
    credit_bills = 0

    for row in bills:
        outstanding = row["due_amount"] - paid_map.get(
            row["id"],
            Decimal("0"),
        )

        if outstanding and outstanding > 0:
            arrears += outstanding

        available = credit_map.get(row["id"], Decimal("0"))
        if available and available > 0:
            credit += available
            credit_bills += 1

    return arrears, ids, credit, credit_bills


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
            # A customer with an overdue month is deactivated and must not
            # receive a new bill until the pending amount is paid.
            sync_customer_statuses_with_cursor(cur)

            cur.execute(
                f"""
                SELECT
                  c.id,
                  c.is_active,
                  p.package_name,
                  p.monthly_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                WHERE c.id = %s
                  {ownership}
                """,
                values,
            )
            customer = cur.fetchone()

            if customer is None:
                return None

            # A deactivated customer still gets a bill at the start of a
            # new month. Any pending amount (and any credit) is carried into
            # it below, so the collector sees one combined Due to collect.
            (
                arrears,
                source_ids,
                credit,
                credit_bills,
            ) = _collect_carry_forward(cur, customer_id)

            base_due = customer["monthly_amount"] + arrears
            credit_applied = min(credit, base_due)
            credit_balance = credit - credit_applied

            cur.execute(
                """
                INSERT INTO monthly_billing (
                  customer_id,
                  billing_month,
                  package_name,
                  monthly_amount,
                  arrears_amount,
                  credit_applied,
                  credit_balance
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    customer_id,
                    billing_month,
                    customer["package_name"],
                    customer["monthly_amount"],
                    arrears,
                    credit_applied,
                    credit_balance,
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

            # Reactivate customers who were only deactivated because a
            # month passed without a bill. Customers with carried arrears
            # stay deactivated until the full Due is collected.
            sync_customer_statuses_with_cursor(cur)
            conn.commit()

    billing = _get_billing_summary_by_id(inserted["id"])
    return {
        "billing": billing,
        "previousOverpaid": {
            "amount": float(credit),
            "bills": credit_bills,
        },
        "creditApplied": float(credit_applied),
        "creditBalance": float(credit_balance),
    }


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
            sync_customer_statuses_with_cursor(cur)

            cur.execute(
                f"""
                SELECT
                  c.id,
                  c.customer_name,
                  c.stb_number,
                  c.is_active,
                  p.package_name,
                  p.monthly_amount
                FROM customers c
                INNER JOIN packages p
                  ON p.id = c.package_id
                WHERE c.id = ANY(%s)
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
                    continue

                row = customers[cid]

                if cid in already_billed:
                    skipped.append(
                        {
                            "customerId": cid,
                            "customerName": row["customer_name"],
                            "stbNumber": row["stb_number"],
                            "reason": "ALREADY_BILLED",
                        }
                    )
                    continue

            # Deactivated customers are billable too: their pending amount
            # is carried into the new bill instead of blocking generation.
            to_insert = [
                cid
                for cid in unique_ids
                if cid in customers and cid not in already_billed
            ]

            for cid in to_insert:
                row = customers[cid]
                (
                    arrears,
                    source_ids,
                    credit,
                    credit_bills,
                ) = _collect_carry_forward(cur, cid)

                base_due = row["monthly_amount"] + arrears
                credit_applied = min(credit, base_due)

                cur.execute(
                    """
                    INSERT INTO monthly_billing (
                      customer_id,
                      billing_month,
                      package_name,
                      monthly_amount,
                      arrears_amount,
                      credit_applied,
                      credit_balance
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        cid,
                        billing_month,
                        row["package_name"],
                        row["monthly_amount"],
                        arrears,
                        credit_applied,
                        credit - credit_applied,
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

                generated.append(
                    {
                        "customerId": cid,
                        "customerName": row["customer_name"],
                        "stbNumber": row["stb_number"],
                        "arrearsAmount": float(arrears or 0),
                        "previousOverpaid": {
                            "amount": float(credit),
                            "bills": credit_bills,
                        },
                        "creditApplied": float(credit_applied),
                    }
                )

            sync_customer_statuses_with_cursor(cur)
            conn.commit()

    return {
        "generated": generated,
        "skipped": skipped,
        "failed": failed,
    }


def adjust_bills(
    *,
    entries: list[dict[str, Any]],
    reason: str | None,
    user_id: str,
) -> dict[str, Any]:
    """Admin override of Due and Overpaid on one or more current bills.

    ``newDue`` and ``newOverpaid`` are absolute target values. The stored
    adjustments are computed against the bill's own figures so the summary
    view shows exactly what the admin entered, and each change is audited.
    Both directions are allowed (waive a charge or add a missed one).
    """
    cleaned: list[tuple[Any, Any, Any]] = []
    seen: set[str] = set()

    for entry in entries:
        billing_id = str(entry["billingId"])
        if billing_id in seen:
            continue
        seen.add(billing_id)

        new_due = Decimal(str(entry["newDue"])).quantize(
            Decimal("0.01")
        )
        new_credit = Decimal(str(entry["newOverpaid"])).quantize(
            Decimal("0.01")
        )

        if new_due < 0 or new_credit < 0:
            raise AppError(
                code="INVALID_REQUEST",
                message="Due and Overpaid cannot be negative.",
                status_code=400,
            )

        cleaned.append((billing_id, new_due, new_credit))

    if not cleaned:
        raise AppError(
            code="INVALID_REQUEST",
            message="Provide at least one bill to adjust.",
            status_code=400,
        )

    results: list[dict[str, Any]] = []

    with get_connection() as conn:
        with conn.cursor() as cur:
            changed = False

            for billing_id, new_due, new_credit in cleaned:
                cur.execute(
                    """
                    SELECT
                      mb.id,
                      mb.customer_id,
                      mb.monthly_amount,
                      mb.arrears_amount,
                      mb.credit_applied,
                      mb.credit_balance,
                      cbs.total_paid,
                      cbs.balance_amount AS previous_due,
                      cbs.credit_available AS previous_credit
                    FROM monthly_billing mb
                    INNER JOIN customer_billing_summary cbs
                      ON cbs.billing_id = mb.id
                    WHERE mb.id = %s
                    FOR UPDATE OF mb
                    """,
                    (billing_id,),
                )
                bill = cur.fetchone()

                if bill is None:
                    raise AppError(
                        code="BILLING_NOT_FOUND",
                        message="A selected bill was not found.",
                        status_code=404,
                    )

                if (
                    new_due == bill["previous_due"]
                    and new_credit == bill["previous_credit"]
                ):
                    results.append(
                        {
                            "billingId": billing_id,
                            "customerId": str(bill["customer_id"]),
                            "changed": False,
                        }
                    )
                    continue

                # The admin edits the *pending* Due shown on the card, so
                # the bill's gross due amount must be set to pending + paid.
                target_due_amount = new_due + bill["total_paid"]

                base_due = (
                    bill["monthly_amount"]
                    + bill["arrears_amount"]
                    - bill["credit_applied"]
                )
                due_adjustment = target_due_amount - base_due

                base_credit = (
                    max(
                        bill["total_paid"] - target_due_amount,
                        Decimal("0"),
                    )
                    + bill["credit_balance"]
                )
                credit_adjustment = new_credit - base_credit

                cur.execute(
                    """
                    UPDATE monthly_billing
                    SET
                      due_adjustment = %s,
                      credit_adjustment = %s,
                      updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        due_adjustment,
                        credit_adjustment,
                        billing_id,
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO bill_adjustments (
                      billing_id,
                      previous_due,
                      new_due,
                      previous_credit,
                      new_credit,
                      reason,
                      changed_by
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING
                      id,
                      billing_id,
                      previous_due,
                      new_due,
                      previous_credit,
                      new_credit,
                      reason,
                      changed_by,
                      created_at
                    """,
                    (
                        billing_id,
                        bill["previous_due"],
                        new_due,
                        bill["previous_credit"],
                        new_credit,
                        reason,
                        user_id,
                    ),
                )
                adjustment = cur.fetchone()

                results.append(
                    {
                        "billingId": billing_id,
                        "customerId": str(bill["customer_id"]),
                        "changed": True,
                        "adjustment": adjustment,
                    }
                )
                changed = True

            if changed:
                sync_customer_statuses_with_cursor(cur)
            conn.commit()

    for result in results:
        result["billing"] = _get_billing_summary_by_id(
            result["billingId"]
        )

    return {"adjustments": results}
