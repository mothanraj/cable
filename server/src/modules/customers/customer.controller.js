const customerService = require("./customer.service");

async function getCustomers(req, res, next) {
  try {
    const { search } = req.query;

    const customers = await customerService.getCustomers({
      userId: req.user.id,
      role: req.user.role,
      search,
    });

    return res.status(200).json({
      success: true,
      data: {
        customers,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getCustomerById(req, res, next) {
  try {
    const customer = await customerService.getCustomerById({
      customerId: req.params.customerId,
      userId: req.user.id,
      role: req.user.role,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message: "Customer not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function createCustomer(req, res, next) {
  try {
    const {
      customerName,
      stbNumber,
      phone,
      place,
      packageId,
      customMonthlyAmount,
      assignedUserId,
      remarks,
    } = req.body;

    if (
      typeof customerName !== "string" ||
      typeof stbNumber !== "string" ||
      typeof packageId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message:
            "Customer name, STB number and package are required.",
        },
      });
    }

    const finalAssignedUserId =
      req.user.role === "ADMIN"
        ? assignedUserId
        : req.user.id;

    if (!finalAssignedUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "ASSIGNED_USER_REQUIRED",
          message: "Assigned user is required.",
        },
      });
    }

    const customer = await customerService.createCustomer({
      customerName: customerName.trim(),
      stbNumber: stbNumber.trim(),
      phone:
        typeof phone === "string"
          ? phone.trim()
          : null,
      place:
        typeof place === "string"
          ? place.trim()
          : null,
      packageId,
      customMonthlyAmount,
      assignedUserId: finalAssignedUserId,
      remarks:
        typeof remarks === "string"
          ? remarks.trim()
          : null,
    });

    return res.status(201).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: {
          code: "STB_NUMBER_EXISTS",
          message: "STB number already exists.",
        },
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REFERENCE",
          message:
            "Package or assigned user does not exist.",
        },
      });
    }

    next(error);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const {
      customerName,
      stbNumber,
      phone,
      place,
      packageId,
      customMonthlyAmount,
      remarks,
    } = req.body;

    if (
      typeof customerName !== "string" ||
      typeof stbNumber !== "string" ||
      typeof packageId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message:
            "Customer name, STB number and package are required.",
        },
      });
    }

    const customer = await customerService.updateCustomer({
      customerId: req.params.customerId,
      userId: req.user.id,
      role: req.user.role,
      customerName: customerName.trim(),
      stbNumber: stbNumber.trim(),
      phone:
        typeof phone === "string"
          ? phone.trim()
          : null,
      place:
        typeof place === "string"
          ? place.trim()
          : null,
      packageId,
      customMonthlyAmount,
      remarks:
        typeof remarks === "string"
          ? remarks.trim()
          : null,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message:
            "Customer not found or you do not have permission to edit it.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: {
          code: "STB_NUMBER_EXISTS",
          message: "STB number already exists.",
        },
      });
    }

    next(error);
  }
}

async function deactivateCustomer(req, res, next) {
  try {
    const customer = await customerService.setCustomerStatus({
      customerId: req.params.customerId,
      userId: req.user.id,
      role: req.user.role,
      isActive: false,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message:
            "Customer not found or you do not have permission.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function updateCustomerOrder(req, res, next) {
  try {
    const { displayOrder } = req.body;

    if (
      !Number.isInteger(displayOrder) ||
      displayOrder < 0
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DISPLAY_ORDER",
          message:
            "Display order must be a non-negative integer.",
        },
      });
    }

    const customer =
      await customerService.updateCustomerOrder({
        customerId: req.params.customerId,
        userId: req.user.id,
        role: req.user.role,
        displayOrder,
      });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message:
            "Customer not found or you do not have permission.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function assignCustomer(req, res, next) {
  try {
    const { assignedUserId } = req.body;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Only administrators can reassign customers.",
        },
      });
    }

    if (typeof assignedUserId !== "string") {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Assigned user ID is required.",
        },
      });
    }

    const customer =
      await customerService.assignCustomer({
        customerId: req.params.customerId,
        assignedUserId,
      });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message: "Customer not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  updateCustomerOrder,
  assignCustomer,
};