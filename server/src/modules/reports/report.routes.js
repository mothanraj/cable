const express = require("express");

const authenticate = require("../../middleware/authenticate");
const controller = require("./report.controller");

const router = express.Router();

router.use(authenticate);

router.get(
  "/billing",
  controller.getBillingReport
);

module.exports = router;