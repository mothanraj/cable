require("dotenv").config();
const reportRoutes = require("./modules/reports/report.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const paymentRoutes = require("./modules/payments/payment.routes");
const billingRoutes = require("./modules/billing/billing.routes");
const packageRoutes = require("./modules/packages/package.routes");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authenticate = require("./middleware/authenticate");
const authorize = require("./middleware/authorize");
const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/user.routes");
const customerRoutes = require("./modules/customers/customer.routes");


const pool = require("./config/database");

const app = express();

app.get(
  "/api/v1/admin/test",
  authenticate,
  authorize("ADMIN"),
  (req, res) => {
    res.json({
      success: true,
      message: "Admin authorization works.",
      user: req.user,
    });
  }
);

app.disable("x-powered-by");

app.use(
  helmet()
);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(cookieParser());

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_AUTH_REQUESTS",
      message: "Too many authentication attempts. Try again later.",
    },
  },
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use(generalRateLimit);

app.use(
  "/api/v1/auth/login",
  authRateLimit
);

app.use(
  "/api/v1/auth",
  authRoutes
);

app.use(
  "/api/v1/customers",
  customerRoutes
);

app.use(
  "/api/v1/reports",
  reportRoutes
);

app.use(
  "/api/v1/packages",
  packageRoutes
);

app.use(
  "/api/v1/payments",
  paymentRoutes
);

app.use(
  "/api/v1/billing",
  billingRoutes
);

app.use(
  "/api/v1/dashboard",
  dashboardRoutes
);

app.use(
  "/api/v1/users",
  userRoutes
);

app.get("/api/v1/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.status(200).json({
      success: true,
      message: "API and database are working.",
      data: {
        databaseTime: result.rows[0].current_time,
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(503).json({
      success: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection is unavailable.",
      },
    });
  }
});

module.exports = app;