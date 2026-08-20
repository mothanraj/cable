const pool = require("../../config/database");

async function getDashboard({
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

  /*
   * Billing summary
   */
  const summaryResult = await pool.query(
    `
      SELECT
        COUNT(DISTINCT c.id) AS total_customers,

        COUNT(
          DISTINCT CASE
            WHEN c.is_active = TRUE
            THEN c.id
          END
        ) AS active_customers,

        COALESCE(
          SUM(cbs.monthly_amount),
          0
        ) AS total_billed,

        COALESCE(
          SUM(cbs.total_paid),
          0
        ) AS total_collected,

        COALESCE(
          SUM(cbs.balance_amount),
          0
        ) AS total_outstanding,

        COUNT(
          CASE
            WHEN cbs.payment_status = 'PAID'
            THEN 1
          END
        ) AS paid_count,

        COUNT(
          CASE
            WHEN cbs.payment_status = 'PARTIAL'
            THEN 1
          END
        ) AS partial_count,

        COUNT(
          CASE
            WHEN cbs.payment_status = 'UNPAID'
            THEN 1
          END
        ) AS unpaid_count

      FROM customer_billing_summary cbs

      INNER JOIN customers c
        ON c.id = cbs.customer_id

      ${whereClause}
    `,
    values
  );

  /*
   * Billing records
   */
  const billingResult = await pool.query(
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
   * Recent payments
   *
   * For users, only payments belonging
   * to their assigned customers are returned.
   */
  const paymentValues = [];
  const paymentConditions = [];

  if (billingMonth) {
    paymentValues.push(billingMonth);
    paymentConditions.push(
      `mb.billing_month = $${paymentValues.length}`
    );
  }

  if (role !== "ADMIN") {
    paymentValues.push(userId);
    paymentConditions.push(
      `c.assigned_user_id = $${paymentValues.length}`
    );
  }

  const paymentWhereClause =
    paymentConditions.length > 0
      ? `WHERE ${paymentConditions.join(" AND ")}`
      : "";

  const paymentsResult = await pool.query(
    `
      SELECT
        p.id,
        p.billing_id,
        mb.customer_id,

        c.customer_name,
        c.stb_number,

        mb.billing_month,
        mb.package_name,
        mb.monthly_amount,

        p.payment_date,
        p.collected_amount,
        p.remarks,

        creator.username AS created_by_username,
        creator.full_name AS created_by_name,

        p.created_at

      FROM payments p

      INNER JOIN monthly_billing mb
        ON mb.id = p.billing_id

      INNER JOIN customers c
        ON c.id = mb.customer_id

      INNER JOIN users creator
        ON creator.id = p.created_by

      ${paymentWhereClause}

      ORDER BY
        p.payment_date DESC,
        p.created_at DESC

      LIMIT 10
    `,
    paymentValues
  );

  const summary = summaryResult.rows[0];

  return {
    summary: {
      totalCustomers:
        Number(summary.total_customers),

      activeCustomers:
        Number(summary.active_customers),

      totalBilled:
        Number(summary.total_billed),

      totalCollected:
        Number(summary.total_collected),

      totalOutstanding:
        Number(summary.total_outstanding),

      paidCount:
        Number(summary.paid_count),

      partialCount:
        Number(summary.partial_count),

      unpaidCount:
        Number(summary.unpaid_count),
    },

    billing: billingResult.rows,

    recentPayments: paymentsResult.rows,
  };
}

module.exports = {
  getDashboard,
};