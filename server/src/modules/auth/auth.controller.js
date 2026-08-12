const authService = require("./auth.service");

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/v1/auth",
};

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Username and password are required.",
        },
      });
    }

    const result = await authService.login(
      username.trim(),
      password,
      {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip,
      }
    );

    if (!result) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid username or password.",
        },
      });
    }

    res.cookie(
      "refreshToken",
      result.refreshToken,
      REFRESH_COOKIE_OPTIONS
    );

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies.refreshToken;

    const result = await authService.refreshSession(
      refreshToken,
      {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip,
      }
    );

    if (!result) {
      res.clearCookie(
        "refreshToken",
        REFRESH_COOKIE_OPTIONS
      );

      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_SESSION",
          message: "Session is invalid or expired.",
        },
      });
    }

    res.cookie(
      "refreshToken",
      result.refreshToken,
      REFRESH_COOKIE_OPTIONS
    );

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(
      req.cookies.refreshToken
    );

    res.clearCookie(
      "refreshToken",
      REFRESH_COOKIE_OPTIONS
    );

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  refresh,
  logout,
};