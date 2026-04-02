const dotenv = require("dotenv");

dotenv.config();

function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isLocalOrIpHost(hostname) {
  const normalizedHost = String(hostname || "").toLowerCase();
  return (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1" ||
    normalizedHost === "[::1]" ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(normalizedHost)
  );
}

function appendWwwAlias(origins) {
  const expanded = new Set(origins);

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      const hostname = parsed.hostname.toLowerCase();

      if (isLocalOrIpHost(hostname)) {
        continue;
      }

      const hostParts = hostname.split(".").filter(Boolean);
      const shouldAliasApex = hostParts.length === 2;
      const shouldAliasWww = hostParts.length === 3 && hostParts[0] === "www";

      if (!shouldAliasApex && !shouldAliasWww) {
        continue;
      }

      const aliasHost = hostname.startsWith("www.") ? hostname.slice(4) : `www.${hostname}`;
      const aliasOrigin = `${parsed.protocol}//${aliasHost}${parsed.port ? `:${parsed.port}` : ""}`;
      expanded.add(aliasOrigin);
    } catch {
      // Ignore invalid origins and keep explicit values only.
    }
  }

  return Array.from(expanded);
}

function parseCorsOrigins(value) {
  if (!value || value.trim() === "*") {
    return "*";
  }

  const configuredOrigins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return appendWwwAlias(configuredOrigins);
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
