-- Renumber display_order per (assigned_user_id, place_id) scope so each
-- collector's arrangement is stored consistently per place group.
-- Order is preserved by the previous display_order, ties broken by name.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY assigned_user_id, place_id
      ORDER BY display_order ASC, customer_name ASC
    ) - 1 AS new_order
  FROM customers
)
UPDATE customers c
SET display_order = ranked.new_order
FROM ranked
WHERE c.id = ranked.id;

-- Composite index matching the scoped ordering used by list queries.
CREATE INDEX IF NOT EXISTS idx_customers_scope_order
  ON customers (assigned_user_id, place_id, display_order);
