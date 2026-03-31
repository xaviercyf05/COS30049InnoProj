const dotenv = require("dotenv");

dotenv.config();

function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCorsOrigins(value) {
  if (!value || value.trim() === "*") {
    return "*";
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parsePort(process.env.PORT, 3000),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  serveStaticClient: parseBoolean(process.env.SERVE_STATIC_CLIENT, true),
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parsePort(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "innopapp",
  },
  jwtSecret: process.env.JWT_SECRET || "change-this-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
};

if (env.nodeEnv === "production" && env.jwtSecret === "change-this-in-production") {
  throw new Error("JWT_SECRET must be set in production.");
}

module.exports = env;
