const dashboardService = require("./dashboard.service");

function isValidBillingMonth(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-01$/.test(value)
  );
}

async function getDashboard(req, res, next) {
  try {
    const { billingMonth } = req.query;

    if (
      billingMonth !== undefined &&
      !isValidBillingMonth(billingMonth)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_BILLING_MONTH",
          message:
            "Billing month must use YYYY-MM-01 format.",
        },
      });
    }

    const dashboard =
      await dashboardService.getDashboard({
        userId: req.user.id,
        role: req.user.role,
        billingMonth,
      });

    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
};