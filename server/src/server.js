require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log(" Cable Customer Management API");
  console.log("========================================");
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("");
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down...`);

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));