-- Show an admin-granted credit as OVERPAID in reports as well as on the
-- customer card. All other status rules stay the same.

CREATE OR REPLACE VIEW customer_billing_summary AS
SELECT
    mb.id AS billing_id,

    mb.customer_id,

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

    mb.rolled_forward_to_billing_id,

    (mb.rolled_forward_to_billing_id IS NULL) AS is_effective,

    COALESCE(
        SUM(p.collected_amount),
        0
    ) AS total_paid,

    GREATEST(
        GREATEST(
            mb.monthly_amount + mb.arrears_amount
            - mb.credit_applied + mb.due_adjustment,
            0
        ) - COALESCE(SUM(p.collected_amount), 0),
        0
    ) AS balance_amount,

    GREATEST(
        COALESCE(SUM(p.collected_amount), 0)
        - GREATEST(
            mb.monthly_amount + mb.arrears_amount
            - mb.credit_applied + mb.due_adjustment,
            0
          ),
        0
    ) + mb.credit_balance + mb.credit_adjustment AS credit_available,

    CASE
        WHEN mb.credit_adjustment > 0
            THEN 'OVERPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0) = 0
             AND GREATEST(
                   mb.monthly_amount + mb.arrears_amount
                   - mb.credit_applied + mb.due_adjustment,
                   0
                 ) > 0
            THEN 'UNPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             > GREATEST(
                 mb.monthly_amount + mb.arrears_amount
                 - mb.credit_applied + mb.due_adjustment,
                 0
               )
            THEN 'OVERPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             < GREATEST(
                 mb.monthly_amount + mb.arrears_amount
                 - mb.credit_applied + mb.due_adjustment,
                 0
               )
            THEN 'PARTIAL'

        ELSE 'PAID'
    END AS payment_status

FROM monthly_billing mb

LEFT JOIN payments p
    ON p.billing_id = mb.id

GROUP BY
    mb.id,
    mb.customer_id,
    mb.billing_month,
    mb.package_name,
    mb.monthly_amount,
    mb.arrears_amount,
    mb.credit_applied,
    mb.credit_balance,
    mb.due_adjustment,
    mb.credit_adjustment,
    mb.rolled_forward_to_billing_id;
