CREATE OR REPLACE VIEW customer_billing_summary AS
SELECT
    mb.id AS billing_id,

    mb.customer_id,

    mb.billing_month,

    mb.package_name,

    mb.monthly_amount,

    COALESCE(
        SUM(p.collected_amount),
        0
    ) AS total_paid,

    GREATEST(
        mb.monthly_amount
        - COALESCE(SUM(p.collected_amount), 0),
        0
    ) AS balance_amount,

    CASE
        WHEN COALESCE(SUM(p.collected_amount), 0) = 0
            THEN 'UNPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             < mb.monthly_amount
            THEN 'PARTIAL'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             > mb.monthly_amount
            THEN 'OVERPAID'

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
    mb.monthly_amount;
