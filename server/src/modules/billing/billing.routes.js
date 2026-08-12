const express = require("express");

const authenticate = require("../../middleware/authenticate");
const controller = require("./billing.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", controller.getBilling);

router.get(
  "/:billingId",
  controller.getBillingById
);

router.post(
  "/generate",
  controller.generateBilling
);

module.exports = router;