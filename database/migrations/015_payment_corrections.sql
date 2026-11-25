-- Audit trail for admin corrections to a collector's entered amount.
--
-- Bills and payment status are derived from payments.collected_amount, so
-- correcting an amount immediately updates Due/Paid/Balance and the
-- UNPAID/PARTIAL/PAID/OVERPAID status. This table records who changed the
-- figure, what it was before, and why.

CREATE TABLE payment_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payment_id UUID NOT NULL
        REFERENCES payments(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    old_amount NUMERIC(10,2) NOT NULL
        CHECK (old_amount > 0),

    new_amount NUMERIC(10,2) NOT NULL
        CHECK (new_amount > 0),

    reason TEXT,

    changed_by UUID NOT NULL
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_corrections_payment
    ON payment_corrections(payment_id);

-- Supabase's auto-generated REST API must not expose correction records.
ALTER TABLE payment_corrections ENABLE ROW LEVEL SECURITY;
