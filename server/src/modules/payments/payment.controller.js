const paymentService = require("./payment.service");

function isValidPaymentDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

async function getPayments(req, res, next) {
  try {
    const { billingId } = req.query;

    const payments = await paymentService.getPayments({
      userId: req.user.id,
      role: req.user.role,
      billingId,
    });

    return res.status(200).json({
      success: true,
      data: {
        payments,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getPaymentById(req, res, next) {
  try {
    const payment =
      await paymentService.getPaymentById({
        paymentId: req.params.paymentId,
        userId: req.user.id,
        role: req.user.role,
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PAYMENT_NOT_FOUND",
          message:
            "Payment record not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        payment,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function createPayment(req, res, next) {
  try {
    const {
      billingId,
      paymentDate,
      collectedAmount,
      remarks,
    } = req.body;

    if (
      typeof billingId !== "string" ||
      !isValidPaymentDate(paymentDate) ||
      collectedAmount === undefined ||
      collectedAmount === null ||
      Number(collectedAmount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message:
            "Billing ID, valid payment date, and a positive collected amount are required.",
        },
      });
    }

    const payment =
      await paymentService.createPayment({
        billingId,
        paymentDate,
        collectedAmount,
        remarks: remarks || null,
        userId: req.user.id,
        role: req.user.role,
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: {
          code: "BILLING_NOT_FOUND",
          message:
            "Billing record not found or you do not have permission.",
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        payment,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPayments,
  getPaymentById,
  createPayment,
};