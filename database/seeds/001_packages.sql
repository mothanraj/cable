INSERT INTO packages (
    package_name,
    monthly_amount
)
VALUES
    ('TCCL Classic Package', 250.00),
    ('TCCL Premium Package', 280.00),
    ('TCCL Rural Package', 200.00),
    ('TCCL Rural Package + Vijay TV', 220.00),
    ('TCCL Rural Package + Zee Tamil', 220.00),
    ('TCCL Basic Package + Any One Channel', 150.00),
    ('TCCL Classic Package + Addons Channel', 280.00)
ON CONFLICT (package_name)
DO UPDATE SET
    monthly_amount = EXCLUDED.monthly_amount,
    is_active = TRUE;