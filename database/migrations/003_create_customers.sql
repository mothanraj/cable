CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_name VARCHAR(150) NOT NULL,

    stb_number VARCHAR(50) NOT NULL UNIQUE,

    phone VARCHAR(20),

    place VARCHAR(150),

    package_id UUID NOT NULL,

    custom_monthly_amount NUMERIC(10,2),

    assigned_user_id UUID NOT NULL,

    display_order INTEGER NOT NULL DEFAULT 0,

    remarks TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_customer_package
        FOREIGN KEY (package_id)
        REFERENCES packages(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_customer_user
        FOREIGN KEY (assigned_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT check_custom_monthly_amount
        CHECK (
            custom_monthly_amount IS NULL
            OR custom_monthly_amount >= 0
        )
);