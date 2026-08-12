const pool = require("../../config/database");

async function getPackages() {
  const result = await pool.query(`
    SELECT
      id,
      package_name,
      monthly_amount,
      is_active,
      created_at,
      updated_at
    FROM packages
    WHERE is_active = TRUE
    ORDER BY
      monthly_amount ASC,
      package_name ASC
  `);

  return result.rows;
}

async function getPackageById(packageId) {
  const result = await pool.query(
    `
    SELECT
      id,
      package_name,
      monthly_amount,
      is_active,
      created_at,
      updated_at
    FROM packages
    WHERE id = $1
      AND is_active = TRUE
    `,
    [packageId]
  );

  return result.rows[0] || null;
}

module.exports = {
  getPackages,
  getPackageById,
};