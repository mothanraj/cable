const pool = require("../../config/database");

async function getPayments({
  userId,
  role,
  billingId,
}) {
  const values = [];
  const conditions = [];

  if (billingId) {
    values.push(billingId);
    conditions.push(`p.billing_id = $${values.length}`);
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
        p.id,
        p.billing_id,
        mb.customer_id,
        c.customer_name,
        c.stb_number,
        c.phone,
        c.place,
        c.assigned_user_id,
        assigned_user.username AS assigned_username,
        assigned_user.full_name AS assigned_user_name,
        mb.billing_month,
        mb.package_name,
        mb.monthly_amount,
        p.payment_date,
        p.collected_amount,
        p.remarks,
        p.created_by,
        creator.username AS created_by_username,
        creator.full_name AS created_by_name,
        p.created_at,
        p.updated_at
      FROM payments p
      INNER JOIN monthly_billing mb
        ON mb.id = p.billing_id
      INNER JOIN customers c
        ON c.id = mb.customer_id
      INNER JOIN users assigned_user
        ON assigned_user.id = c.assigned_user_id
      INNER JOIN users creator
        ON creator.id = p.created_by
      ${whereClause}
      ORDER BY
        p.payment_date DESC,
        p.created_at DESC
    `,
    values
  );

  return result.rows;
}

async function getPaymentById({
  paymentId,
  userId,
  role,
}) {
  const values = [paymentId];

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
        p.id,
        p.billing_id,
        mb.customer_id,
        c.customer_name,
        c.stb_number,
        c.phone,
        c.place,
        c.assigned_user_id,
        assigned_user.username AS assigned_username,
        assigned_user.full_name AS assigned_user_name,
        mb.billing_month,
        mb.package_name,
        mb.monthly_amount,
        p.payment_date,
        p.collected_amount,
        p.remarks,
        p.created_by,
        creator.username AS created_by_username,
        creator.full_name AS created_by_name,
        p.created_at,
        p.updated_at
      FROM payments p
      INNER JOIN monthly_billing mb
        ON mb.id = p.billing_id
      INNER JOIN customers c
        ON c.id = mb.customer_id
      INNER JOIN users assigned_user
        ON assigned_user.id = c.assigned_user_id
      INNER JOIN users creator
        ON creator.id = p.created_by
      WHERE p.id = $1
        ${ownershipCondition}
    `,
    values
  );

  return result.rows[0] || null;
}

async function createPayment({
  billingId,
  paymentDate,
  collectedAmount,
  remarks,
  userId,
  role,
}) {
  const values = [billingId, paymentDate, collectedAmount, remarks, userId];

  let ownershipCondition = "";

  if (role !== "ADMIN") {
    values.push(userId);

    ownershipCondition = `
      AND c.assigned_user_id = $6
    `;
  }

  const billingQueryValues =
  role === "ADMIN"
    ? [billingId]
    : [billingId, userId];

const billingResult = await pool.query(
  `
    SELECT
      mb.id,
      mb.customer_id,
      mb.monthly_amount
    FROM monthly_billing mb
    INNER JOIN customers c
      ON c.id = mb.customer_id
    WHERE mb.id = $1
      AND c.is_active = TRUE
      ${
        role !== "ADMIN"
          ? "AND c.assigned_user_id = $2"
          : ""
      }
  `,
  billingQueryValues
);

  if (billingResult.rows.length === 0) {
    return null;
  }

  const result = await pool.query(
    `
      INSERT INTO payments (
        billing_id,
        payment_date,
        collected_amount,
        remarks,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        billing_id,
        payment_date,
        collected_amount,
        remarks,
        created_by,
        created_at,
        updated_at
    `,
    values.slice(0, 5)
  );

  return result.rows[0];
}

module.exports = {
  getPayments,
  getPaymentById,
  createPayment,
};