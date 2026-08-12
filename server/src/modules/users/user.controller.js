const userService = require("./user.service");

async function createUser(req, res, next) {
  try {
    const {
      username,
      fullName,
      password,
    } = req.body;

    if (
      typeof username !== "string" ||
      typeof fullName !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Username, full name and password are required.",
        },
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 12 characters.",
        },
      });
    }

    const user = await userService.createUser({
      username: username.trim(),
      fullName: fullName.trim(),
      password,
    });

    return res.status(201).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: {
          code: "USERNAME_EXISTS",
          message: "Username already exists.",
        },
      });
    }

    next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const users = await userService.getUsers();

    return res.status(200).json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function activateUser(req, res, next) {
  try {
    const user = await userService.setUserStatus(
      req.params.userId,
      true
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    return res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function deactivateUser(req, res, next) {
  try {
    const user = await userService.setUserStatus(
      req.params.userId,
      false
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    return res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUser,
  getUsers,
  activateUser,
  deactivateUser,
};