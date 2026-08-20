const pool = require("../../config/database");

async function getBillingReport({
  userId,
  role,
  billingMonth,
}) {
  const values = [];
  const conditions = [];

  /*
   * Filter by billing month
   */
  if (billingMonth) {
    values.push(billingMonth);

    conditions.push(
      `cbs.billing_month = $${values.length}`
    );
  }

  /*
   * USER can only see customers
   * assigned to that user.
   *
   * ADMIN can see all customers.
   */
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

  /*
   * Billing report
   */
  const result = await pool.query(
    `
      SELECT
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

  /*
   * Calculate report totals
   */
  const totalCustomers = result.rows.length;

  const totalBilled = result.rows.reduce(
    (sum, row) =>
      sum + Number(row.monthly_amount || 0),
    0
  );

  const totalCollected = result.rows.reduce(
    (sum, row) =>
      sum + Number(row.total_paid || 0),
    0
  );

  const totalOutstanding = result.rows.reduce(
    (sum, row) =>
      sum + Number(row.balance_amount || 0),
    0
  );

  const paidCount = result.rows.filter(
    (row) => row.payment_status === "PAID"
  ).length;

  const partialCount = result.rows.filter(
    (row) => row.payment_status === "PARTIAL"
  ).length;

  const unpaidCount = result.rows.filter(
    (row) => row.payment_status === "UNPAID"
  ).length;

  return {
    summary: {
      totalCustomers,
      totalBilled,
      totalCollected,
      totalOutstanding,
      paidCount,
      partialCount,
      unpaidCount,
    },

    records: result.rows,
  };
}

module.exports = {
  getBillingReport,
};