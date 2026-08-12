const express = require("express");

const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

const controller = require("./user.controller");

const router = express.Router();

router.use(authenticate);
router.use(authorize("ADMIN"));

router.get("/", controller.getUsers);

router.post("/", controller.createUser);

router.patch(
  "/:userId/activate",
  controller.activateUser
);

router.patch(
  "/:userId/deactivate",
  controller.deactivateUser
);

module.exports = router;