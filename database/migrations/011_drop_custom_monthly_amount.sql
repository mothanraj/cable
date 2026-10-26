ALTER TABLE customers
DROP CONSTRAINT IF EXISTS check_custom_monthly_amount;

ALTER TABLE customers
DROP COLUMN IF EXISTS custom_monthly_amount;
