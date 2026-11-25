-- Apply overpaid credits to the next generated bill.
--
-- A customer's `Due` is the running outstanding balance. Credits left over
-- from an overpaid bill are carried into the next bill and reduce its due.
-- `credit_applied` records how much of that credit was used on this bill,
-- while `credit_balance` keeps any unused remainder for the following one.

ALTER TABLE monthly_billing
    ADD COLUMN credit_applied NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (credit_applied >= 0),
    ADD COLUMN credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (credit_balance >= 0);

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

    GREATEST(
        mb.monthly_amount + mb.arrears_amount - mb.credit_applied,
        0
    ) AS due_amount,

    mb.rolled_forward_to_billing_id,

    (mb.rolled_forward_to_billing_id IS NULL) AS is_effective,

    COALESCE(
        SUM(p.collected_amount),
        0
    ) AS total_paid,

    GREATEST(
        mb.monthly_amount + mb.arrears_amount - mb.credit_applied
        - COALESCE(SUM(p.collected_amount), 0),
        0
    ) AS balance_amount,

    GREATEST(
        COALESCE(SUM(p.collected_amount), 0)
        - GREATEST(
            mb.monthly_amount + mb.arrears_amount - mb.credit_applied,
            0
          ),
        0
    ) + mb.credit_balance AS credit_available,

    CASE
        WHEN COALESCE(SUM(p.collected_amount), 0) = 0
             AND GREATEST(
                   mb.monthly_amount + mb.arrears_amount - mb.credit_applied,
                   0
                 ) > 0
            THEN 'UNPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             > GREATEST(
                 mb.monthly_amount + mb.arrears_amount - mb.credit_applied,
                 0
               )
            THEN 'OVERPAID'

        WHEN COALESCE(SUM(p.collected_amount), 0)
             < GREATEST(
                 mb.monthly_amount + mb.arrears_amount - mb.credit_applied,
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
    mb.rolled_forward_to_billing_id;

-- Keep Supabase's auto-generated REST API locked out of the recreated view.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'ALTER VIEW public.customer_billing_summary SET (security_invoker = true)';
  END IF;
END $$;
