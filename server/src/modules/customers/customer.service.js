const pool = require("../../config/database");

async function getCustomers({ userId, role, search }) {
  const values = [];
  const conditions = ["c.is_active = TRUE"];

  if (role !== "ADMIN") {
    values.push(userId);
    conditions.push(`c.assigned_user_id = $${values.length}`);
  }

  if (search && search.trim()) {
    values.push(`%${search.trim()}%`);
    conditions.push(`
      (
        c.customer_name ILIKE $${values.length}
        OR c.stb_number ILIKE $${values.length}
        OR c.phone ILIKE $${values.length}
        OR c.place ILIKE $${values.length}
      )
    `);
  }

  const result = await pool.query(
    `
    SELECT
      c.id,
      c.customer_name,
      c.stb_number,
      c.phone,
      c.place,
      c.package_id,
      p.package_name,
      p.monthly_amount AS package_monthly_amount,
      c.custom_monthly_amount,
      COALESCE(
        c.custom_monthly_amount,
        p.monthly_amount
      ) AS effective_monthly_amount,
      c.assigned_user_id,
      u.username AS assigned_username,
      u.full_name AS assigned_user_name,
      c.display_order,
      c.remarks,
      c.is_active,
      c.created_at,
      c.updated_at
    FROM customers c
    INNER JOIN packages p
      ON p.id = c.package_id
    INNER JOIN users u
      ON u.id = c.assigned_user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY
      c.display_order ASC,
      c.customer_name ASC
    `,
    values
  );

  return result.rows;
}

async function getCustomerById({
  customerId,
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

  const result = await pool.query(
    `
    SELECT
      c.id,
      c.customer_name,
      c.stb_number,
      c.phone,
      c.place,
      c.package_id,
      p.package_name,
      p.monthly_amount AS package_monthly_amount,
      c.custom_monthly_amount,
      COALESCE(
        c.custom_monthly_amount,
        p.monthly_amount
      ) AS effective_monthly_amount,
      c.assigned_user_id,
      u.username AS assigned_username,
      u.full_name AS assigned_user_name,
      c.display_order,
      c.remarks,
      c.is_active,
      c.created_at,
      c.updated_at
    FROM customers c
    INNER JOIN packages p
      ON p.id = c.package_id
    INNER JOIN users u
      ON u.id = c.assigned_user_id
    WHERE c.id = $1
      AND c.is_active = TRUE
      ${ownershipCondition}
    `,
    values
  );

  return result.rows[0] || null;
}

async function createCustomer({
  customerName,
  stbNumber,
  phone,
  place,
  packageId,
  customMonthlyAmount,
  assignedUserId,
  remarks,
}) {
  const result = await pool.query(
    `
    INSERT INTO customers (
      customer_name,
      stb_number,
      phone,
      place,
      package_id,
      custom_monthly_amount,
      assigned_user_id,
      remarks
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8
    )
    RETURNING
      id,
      customer_name,
      stb_number,
      phone,
      place,
      package_id,
      custom_monthly_amount,
      assigned_user_id,
      display_order,
      remarks,
      is_active,
      created_at,
      updated_at
    `,
    [
      customerName,
      stbNumber,
      phone || null,
      place || null,
      packageId,
      customMonthlyAmount ?? null,
      assignedUserId,
      remarks || null,
    ]
  );

  return result.rows[0];
}

async function updateCustomer({
  customerId,
  userId,
  role,
  customerName,
  stbNumber,
  phone,
  place,
  packageId,
  customMonthlyAmount,
  remarks,
}) {
  const values = [
    customerName,
    stbNumber,
    phone || null,
    place || null,
    packageId,
    customMonthlyAmount ?? null,
    remarks || null,
    customerId,
  ];

  let ownershipCondition = "";

  if (role !== "ADMIN") {
    values.push(userId);
    ownershipCondition = `
      AND assigned_user_id = $9
    `;
  }

  const result = await pool.query(
    `
    UPDATE customers
    SET
      customer_name = $1,
      stb_number = $2,
      phone = $3,
      place = $4,
      package_id = $5,
      custom_monthly_amount = $6,
      remarks = $7,
      updated_at = NOW()
    WHERE id = $8
      AND is_active = TRUE
      ${ownershipCondition}
    RETURNING
      id,
      customer_name,
      stb_number,
      phone,
      place,
      package_id,
      custom_monthly_amount,
      assigned_user_id,
      display_order,
      remarks,
      is_active,
      created_at,
      updated_at
    `,
    values
  );

  return result.rows[0] || null;
}

async function setCustomerStatus({
  customerId,
  userId,
  role,
  isActive,
}) {
  const values = [isActive, customerId];

  let ownershipCondition = "";

  if (role !== "ADMIN") {
    values.push(userId);
    ownershipCondition = `
      AND assigned_user_id = $3
    `;
  }

  const result = await pool.query(
    `
    UPDATE customers
    SET
      is_active = $1,
      updated_at = NOW()
    WHERE id = $2
      ${ownershipCondition}
    RETURNING
      id,
      customer_name,
      stb_number,
      is_active,
      updated_at
    `,
    values
  );

  return result.rows[0] || null;
}

async function updateCustomerOrder({
  customerId,
  userId,
  role,
  displayOrder,
}) {
  const values = [displayOrder, customerId];

  let ownershipCondition = "";

  if (role !== "ADMIN") {
    values.push(userId);
    ownershipCondition = `
      AND assigned_user_id = $3
    `;
  }

  const result = await pool.query(
    `
    UPDATE customers
    SET
      display_order = $1,
      updated_at = NOW()
    WHERE id = $2
      AND is_active = TRUE
      ${ownershipCondition}
    RETURNING
      id,
      customer_name,
      display_order,
      updated_at
    `,
    values
  );

  return result.rows[0] || null;
}

async function assignCustomer({
  customerId,
  assignedUserId,
}) {
  const result = await pool.query(
    `
    UPDATE customers
    SET
      assigned_user_id = $1,
      updated_at = NOW()
    WHERE id = $2
      AND is_active = TRUE
    RETURNING
      id,
      customer_name,
      stb_number,
      assigned_user_id,
      updated_at
    `,
    [assignedUserId, customerId]
  );

  return result.rows[0] || null;
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  updateCustomerOrder,
  assignCustomer,
};