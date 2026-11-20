from decimal import Decimal
from typing import Any

from app.config.database import get_connection
from app.modules.customers.service import (
    get_customer_arrears_with_cursor,
    get_overdue_bills_with_cursor,
    sync_customer_statuses_with_cursor,
)
from app.utils.errors import AppError


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
                  {ownership}
                """,
                billing_values,
            )
            billing = cur.fetchone()

            if billing is None:
                return None

            # While a customer has past-month arrears, only those arrears
            # bills may be collected. The current month's bill waits until
            # the customer is reactivated.
            overdue_bills = get_overdue_bills_with_cursor(
                cur, billing["customer_id"]
            )

            if overdue_bills and str(billing["id"]) not in {
                str(bill["id"]) for bill in overdue_bills
            }:
                pending = get_customer_arrears_with_cursor(
                    cur, billing["customer_id"]
                )
                amount = pending["amount"] or 0
                raise AppError(
                    code="CUSTOMER_IN_ARREARS",
                    message=(
                        f"Customer has ₹{amount:,.2f} in arrears. "
                        "Collect the pending amount first."
                    ),
                    status_code=409,
                )

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

            # Paying off the last overdue bill reactivates the customer.
            sync_customer_statuses_with_cursor(cur)
            conn.commit()
            return payment


def pay_arrears(
    *,
    customer_id: str,
    collected_amount: float,
    payment_date: str,
    remarks: str | None,
    user_id: str,
    role: str,
) -> dict[str, Any] | None:
    """Collect a lump sum against a customer's past-month arrears.

    The amount is allocated oldest bill first, so a full payment always
    clears the deactivation. Partial payments leave the customer in
    arrears with the remaining balance still owed.
    """
    amount = Decimal(str(collected_amount)).quantize(Decimal("0.01"))

    if amount <= 0:
        raise AppError(
            code="INVALID_REQUEST",
            message="A positive arrears amount is required.",
            status_code=400,
        )

    customer_values: list[Any] = [customer_id]
    ownership = ""

    if role != "ADMIN":
        customer_values.append(user_id)
        ownership = "AND c.assigned_user_id = %s"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT c.id
                FROM customers c
                WHERE c.id = %s
                  {ownership}
                """,
                customer_values,
            )
            if cur.fetchone() is None:
                return None

            # Lock the effective bills so two collectors cannot spend the
            # same arrears at the same time.
            cur.execute(
                """
                SELECT mb.id
                FROM monthly_billing mb
                WHERE mb.customer_id = %s
                  AND mb.rolled_forward_to_billing_id IS NULL
                ORDER BY mb.billing_month, mb.id
                FOR UPDATE OF mb
                """,
                (customer_id,),
            )

            overdue_bills = get_overdue_bills_with_cursor(
                cur, customer_id
            )
            total = sum(
                (bill["balance"] for bill in overdue_bills),
                Decimal("0"),
            )

            if total <= 0:
                raise AppError(
                    code="NO_ARREARS",
                    message="This customer has no pending arrears.",
                    status_code=409,
                )

            if amount > total:
                raise AppError(
                    code="ARREARS_AMOUNT_TOO_HIGH",
                    message=(
                        f"Arrears is only ₹{total:,.2f}. "
                        "Enter that amount or less."
                    ),
                    status_code=400,
                )

            payments: list[dict[str, Any]] = []
            remaining = amount

            for bill in overdue_bills:
                if remaining <= 0:
                    break

                allocation = min(remaining, bill["balance"])

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
                        bill["id"],
                        payment_date,
                        allocation,
                        remarks,
                        user_id,
                    ),
                )
                payments.append(cur.fetchone())
                remaining -= allocation

            sync_customer_statuses_with_cursor(cur)

            cur.execute(
                "SELECT is_active FROM customers WHERE id = %s",
                (customer_id,),
            )
            reactivated = bool(cur.fetchone()["is_active"])

            conn.commit()

    return {
        "payments": payments,
        "arrearsPaid": amount,
        "remainingArrears": total - amount,
        "reactivated": reactivated,
    }
