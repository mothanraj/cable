CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    package_name VARCHAR(100) NOT NULL UNIQUE,

    monthly_amount NUMERIC(10,2) NOT NULL
        CHECK (monthly_amount >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);