const express = require("express");

const authenticate = require("../../middleware/authenticate");
const controller = require("./payment.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", controller.getPayments);

router.get(
  "/:paymentId",
  controller.getPaymentById
);

router.post(
  "/",
  controller.createPayment
);

module.exports = router;