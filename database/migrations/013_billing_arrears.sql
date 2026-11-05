-- Carry-forward outstanding balances into the next generated bill.
--
-- A bill for a month can now include `arrears_amount` (the outstanding
-- balances of all earlier bills that were folded into this one).
-- A bill whose balance was folded into a later bill points at that bill
-- via `rolled_forward_to_billing_id` and is excluded from effective
-- outstanding totals.

ALTER TABLE monthly_billing
    ADD COLUMN arrears_amount NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (arrears_amount >= 0),
    ADD COLUMN rolled_forward_to_billing_id UUID
        REFERENCES monthly_billing(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;

CREATE INDEX idx_monthly_billing_rolled_forward
    ON monthly_billing(rolled_forward_to_billing_id);

DROP VIEW IF EXISTS customer_billing_summary;

CREATE VIEW customer_billing_summary AS
SELECT
    mb.id AS billing_id,

    mb.customer_id,

    mb.billing_month,

    mb.package_name,

    mb.monthly_amount,

    mb.arrears_amount,

    mb.monthly_amount + mb.arrears_amount AS due_amount,

    mb.rolled_forward_to_billing_id,

    (mb.rolled_forward_to_billing_id IS NULL) AS is_effective,

    COALESCE(
        SUM(p.collected_amount),
        0
    ) AS total_paid,

    GREATEST(
        mb.monthly_amount + mb.arrears_amount
        - COALESCE(SUM(p.collected_amount), 0),
        0
    ) AS balance_amount,

    CASE
        WHEN COALESCE(SUM(p.collected_amount), 0) = 0
            AND mb.monthly_amount + mb.arrears_amount > 0
            THEN 'UNPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             > (mb.monthly_amount + mb.arrears_amount)
            THEN 'OVERPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             < (mb.monthly_amount + mb.arrears_amount)
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
    mb.rolled_forward_to_billing_id;
