const express = require("express");

const authenticate = require("../../middleware/authenticate");
const controller = require("./customer.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", controller.getCustomers);

router.get(
  "/:customerId",
  controller.getCustomerById
);

router.post("/", controller.createCustomer);

router.patch(
  "/:customerId",
  controller.updateCustomer
);

router.patch(
  "/:customerId/order",
  controller.updateCustomerOrder
);

router.patch(
  "/:customerId/deactivate",
  controller.deactivateCustomer
);

router.patch(
  "/:customerId/assign",
  controller.assignCustomer
);

module.exports = router;