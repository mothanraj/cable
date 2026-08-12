const pool = require("../../config/database");

async function getBilling({
  userId,
  role,
  billingMonth,
}) {
  const values = [];
  const conditions = [];

  if (billingMonth) {
    values.push(billingMonth);
    conditions.push(`mb.billing_month = $${values.length}`);
  }

  if (role !== "ADMIN") {
    values.push(userId);
    conditions.push(`c.assigned_user_id = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result = await pool.query(
    `
    SELECT
      mb.id,
      mb.customer_id,
      c.customer_name,
      c.stb_number,
      c.phone,
      c.place,
      c.assigned_user_id,
      u.username AS assigned_username,
      u.full_name AS assigned_user_name,
      mb.billing_month,
      mb.package_name,
      mb.monthly_amount,
      mb.created_at,
      mb.updated_at
    FROM monthly_billing mb
    INNER JOIN customers c
      ON c.id = mb.customer_id
    INNER JOIN users u
      ON u.id = c.assigned_user_id
    ${whereClause}
    ORDER BY
      mb.billing_month DESC,
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
      mb.id,
      mb.customer_id,
      c.customer_name,
      c.stb_number,
      c.phone,
      c.place,
      c.assigned_user_id,
      u.username AS assigned_username,
      u.full_name AS assigned_user_name,
      mb.billing_month,
      mb.package_name,
      mb.monthly_amount,
      mb.created_at,
      mb.updated_at
    FROM monthly_billing mb
    INNER JOIN customers c
      ON c.id = mb.customer_id
    INNER JOIN users u
      ON u.id = c.assigned_user_id
    WHERE mb.id = $1
      ${ownershipCondition}
    `,
    values
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

  const result = await pool.query(
    `
    INSERT INTO monthly_billing (
      customer_id,
      billing_month,
      package_name,
      monthly_amount
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      customer_id,
      billing_month,
      package_name,
      monthly_amount,
      created_at,
      updated_at
    `,
    [
      customerId,
      billingMonth,
      customer.package_name,
      effectiveAmount,
    ]
  );

  return result.rows[0];
}

module.exports = {
  getBilling,
  getBillingById,
  generateBilling,
};