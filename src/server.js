const app = require("./app");
const env = require("./config/env");
const { pool } = require("./config/db");
const emailService = require("./services/emailService");

const server = app.listen(env.port, () => {
  console.log(`Innopapp API listening on port ${env.port}`);
  void emailService.testEmailConnection();
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down server...`);

  server.close(async () => {
    try {
      await pool.end();
      console.log("Database pool closed.");
      process.exit(0);
    } catch (error) {
      console.error("Error closing database pool:", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
