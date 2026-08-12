CREATE INDEX idx_customers_assigned_user
ON customers(assigned_user_id);

CREATE INDEX idx_customers_package
ON customers(package_id);

CREATE INDEX idx_customers_order
ON customers(assigned_user_id, display_order);

CREATE INDEX idx_customers_place
ON customers(place);

CREATE INDEX idx_customers_name
ON customers(customer_name);

CREATE INDEX idx_customers_phone
ON customers(phone);

CREATE INDEX idx_billing_customer
ON monthly_billing(customer_id);

CREATE INDEX idx_billing_month
ON monthly_billing(billing_month);

CREATE INDEX idx_billing_month_customer
ON monthly_billing(billing_month, customer_id);

CREATE INDEX idx_payments_billing
ON payments(billing_id);

CREATE INDEX idx_payments_date
ON payments(payment_date);

CREATE INDEX idx_payments_created_by
ON payments(created_by);

CREATE INDEX idx_payments_date_billing
ON payments(payment_date, billing_id);