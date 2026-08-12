CREATE TABLE monthly_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_id UUID NOT NULL,

    billing_month DATE NOT NULL,

    package_name VARCHAR(100) NOT NULL,

    monthly_amount NUMERIC(10,2) NOT NULL
        CHECK (monthly_amount >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_billing_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT unique_customer_billing_month
        UNIQUE (customer_id, billing_month)
);