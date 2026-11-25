from typing import Any


def reprice_outstanding_bills(
    cur: Any,
    customer_ids: list[Any],
    package_name: str,
    monthly_amount: Any,
) -> int:
    """Apply a package's current name/price to unsettled bills.

    Only each customer's effective bill with a positive balance is updated.
    Fully paid bills keep the amount they were paid at, and carried arrears
    or credits are left untouched. Callers commit the transaction and should
    refresh customer statuses afterwards so active/deactive reflects the new
    amount.
    """
    ids = [str(customer_id) for customer_id in customer_ids]
    if not ids:
        return 0

    cur.execute(
        """
        UPDATE monthly_billing mb
        SET
          monthly_amount = %s,
          package_name = %s,
          updated_at = NOW()
        WHERE mb.customer_id::text = ANY(%s)
          AND mb.rolled_forward_to_billing_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM customer_billing_summary cbs
            WHERE cbs.billing_id = mb.id
              AND cbs.balance_amount > 0
          )
        """,
        (monthly_amount, package_name, ids),
    )

    return cur.rowcount
