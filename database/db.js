const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

function createClientConfig() {
  const connectionString = (process.env.DATABASE_URL || "").trim();

  const useSsl =
    process.env.DB_SSL === "true" ||
    (process.env.DB_SSLMODE && process.env.DB_SSLMODE !== "disable") ||
    /supabase\.(co|com)/i.test(process.env.DB_HOST || "") ||
    /supabase/i.test(connectionString);

  const config = connectionString
    ? { connectionString }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT || 5432),
        password: process.env.DB_PASSWORD,
      };

  if (useSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

module.exports = { createClientConfig };
