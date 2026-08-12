const billingService = require("./billing.service");

function isValidBillingMonth(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-01$/.test(value)
  );
}

async function getBilling(req, res, next) {
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

    const billing = await billingService.getBilling({
      userId: req.user.id,
      role: req.user.role,
      billingMonth,
    });

    return res.status(200).json({
      success: true,
      data: {
        billing,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getBillingById(req, res, next) {
  try {
    const billing =
      await billingService.getBillingById({
        billingId: req.params.billingId,
        userId: req.user.id,
        role: req.user.role,
      });

    if (!billing) {
      return res.status(404).json({
        success: false,
        error: {
          code: "BILLING_NOT_FOUND",
          message:
            "Billing record not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        billing,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function generateBilling(req, res, next) {
  try {
    const {
      customerId,
      billingMonth,
    } = req.body;

    if (
      typeof customerId !== "string" ||
      !isValidBillingMonth(billingMonth)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message:
            "Customer ID and billing month are required. Billing month must use YYYY-MM-01 format.",
        },
      });
    }

    const billing =
      await billingService.generateBilling({
        customerId,
        billingMonth,
        userId: req.user.id,
        role: req.user.role,
      });

    if (!billing) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message:
            "Customer not found or you do not have permission.",
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        billing,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: {
          code: "BILLING_ALREADY_EXISTS",
          message:
            "Billing already exists for this customer and month.",
        },
      });
    }

    next(error);
  }
}

module.exports = {
  getBilling,
  getBillingById,
  generateBilling,
};