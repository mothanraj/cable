const reportService = require("./report.service");

function isValidBillingMonth(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-01$/.test(value)
  );
}

async function getBillingReport(req, res, next) {
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

    const report =
      await reportService.getBillingReport({
        userId: req.user.id,
        role: req.user.role,
        billingMonth,
      });

    return res.status(200).json({
      success: true,
      data: {
        billing: report,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBillingReport,
};