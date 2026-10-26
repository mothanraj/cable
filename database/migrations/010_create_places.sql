CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    place_name VARCHAR(150) NOT NULL UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO places (place_name)
SELECT DISTINCT TRIM(place)
FROM customers
WHERE place IS NOT NULL
  AND TRIM(place) <> ''
ON CONFLICT (place_name) DO NOTHING;

ALTER TABLE customers
ADD COLUMN place_id UUID;

ALTER TABLE customers
ADD CONSTRAINT fk_customer_place
    FOREIGN KEY (place_id)
    REFERENCES places(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

UPDATE customers c
SET place_id = p.id
FROM places p
WHERE c.place_id IS NULL
  AND c.place IS NOT NULL
  AND TRIM(c.place) = p.place_name;

CREATE INDEX idx_customers_place_id
ON customers(place_id);
