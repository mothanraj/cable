const express = require("express");

const authenticate = require("../../middleware/authenticate");
const controller = require("./package.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", controller.getPackages);

router.get(
  "/:packageId",
  controller.getPackageById
);

module.exports = router;