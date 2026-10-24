const pool = require("../../config/database");

const BILLING_SUMMARY_SELECT = `
  cbs.billing_id AS id,
  cbs.billing_id,
  cbs.customer_id,
  c.customer_name,
  c.stb_number,
  c.phone,
  c.place,
  c.assigned_user_id,
  u.username AS assigned_username,
  u.full_name AS assigned_user_name,
  cbs.billing_month,
  cbs.package_name,
  cbs.monthly_amount,
  cbs.total_paid,
  cbs.balance_amount,
  cbs.payment_status
`;

async function getBilling({
  userId,
  role,
  billingMonth,
}) {
  const values = [];
  const conditions = [];

  if (billingMonth) {
    values.push(billingMonth);
    conditions.push(
      `cbs.billing_month = $${values.length}`
    );
  }

  if (role !== "ADMIN") {
    values.push(userId);
    conditions.push(
      `c.assigned_user_id = $${values.length}`
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result = await pool.query(
    `
    SELECT
      ${BILLING_SUMMARY_SELECT}
    FROM customer_billing_summary cbs
    INNER JOIN customers c
      ON c.id = cbs.customer_id
    INNER JOIN users u
      ON u.id = c.assigned_user_id
    ${whereClause}
    ORDER BY
      cbs.billing_month DESC,
      c.customer_name ASC
    `,
    values
  );

  return result.rows;
}

async function getBillingById({
  billingId,
  userId,
  role,
}) {
  const values = [billingId];

  let ownershipCondition = "";

  if (role !== "ADMIN") {
    values.push(userId);

    ownershipCondition = `
      AND c.assigned_user_id = $2
    `;
  }

  const result = await pool.query(
    `
    SELECT
      ${BILLING_SUMMARY_SELECT}
    FROM customer_billing_summary cbs
    INNER JOIN customers c
      ON c.id = cbs.customer_id
    INNER JOIN users u
      ON u.id = c.assigned_user_id
    WHERE cbs.billing_id = $1
      ${ownershipCondition}
    `,
    values
  );

  return result.rows[0] || null;
}

async function getBillingSummaryById(billingId) {
  const result = await pool.query(
    `
    SELECT
      ${BILLING_SUMMARY_SELECT}
    FROM customer_billing_summary cbs
    INNER JOIN customers c
      ON c.id = cbs.customer_id
    INNER JOIN users u
      ON u.id = c.assigned_user_id
    WHERE cbs.billing_id = $1
    `,
    [billingId]
  );

  return result.rows[0] || null;
}

async function generateBilling({
  customerId,
  billingMonth,
  userId,
  role,
}) {
  const values = [customerId];

  let ownershipCondition = "";

  if (role !== "ADMIN") {
    values.push(userId);

    ownershipCondition = `
      AND c.assigned_user_id = $2
    `;
  }

  const customerResult = await pool.query(
    `
    SELECT
      c.id,
      c.custom_monthly_amount,
      p.package_name,
      p.monthly_amount
    FROM customers c
    INNER JOIN packages p
      ON p.id = c.package_id
    WHERE c.id = $1
      AND c.is_active = TRUE
      AND p.is_active = TRUE
      ${ownershipCondition}
    `,
    values
  );

  if (customerResult.rows.length === 0) {
    return null;
  }

  const customer = customerResult.rows[0];

  const effectiveAmount =
    customer.custom_monthly_amount !== null
      ? customer.custom_monthly_amount
      : customer.monthly_amount;

  const inserted = await pool.query(
    `
    INSERT INTO monthly_billing (
      customer_id,
      billing_month,
      package_name,
      monthly_amount
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [
      customerId,
      billingMonth,
      customer.package_name,
      effectiveAmount,
    ]
  );

  return getBillingSummaryById(inserted.rows[0].id);
}

module.exports = {
  getBilling,
  getBillingById,
  generateBilling,
};
