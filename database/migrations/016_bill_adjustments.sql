-- Admin adjustments to a bill's Due and Overpaid (credit).
--
-- Adjustments are not payments: they do not change collected totals or
-- collector attribution. Due adjustments roll forward with unpaid balances;
-- credit adjustments are applied by the next generated bill.

-- IF NOT EXISTS keeps this migration safe alongside the earlier
-- 016_due_adjustments.sql, which already added `due_adjustment` on some
-- deployments.
ALTER TABLE monthly_billing
    ADD COLUMN IF NOT EXISTS due_adjustment
        NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit_adjustment
        NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS bill_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    billing_id UUID NOT NULL
        REFERENCES monthly_billing(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    previous_due NUMERIC(10,2) NOT NULL,
    new_due NUMERIC(10,2) NOT NULL,
    previous_credit NUMERIC(10,2) NOT NULL,
    new_credit NUMERIC(10,2) NOT NULL,
    reason TEXT,

    changed_by UUID NOT NULL
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_adjustments_billing
    ON bill_adjustments(billing_id);

ALTER TABLE bill_adjustments ENABLE ROW LEVEL SECURITY;

DROP VIEW IF EXISTS customer_billing_summary;

CREATE VIEW customer_billing_summary AS
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

-- Keep Supabase's auto-generated REST API locked out of the recreated view.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'ALTER VIEW public.customer_billing_summary SET (security_invoker = true)';
  END IF;
END $$;
