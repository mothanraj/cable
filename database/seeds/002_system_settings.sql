INSERT INTO system_settings (
    key,
    value
)
VALUES (
    'current_billing_month',
    TO_CHAR(
        DATE_TRUNC('month', CURRENT_DATE),
        'YYYY-MM-DD'
    )
)
ON CONFLICT (key)
DO UPDATE SET
    value = EXCLUDED.value;