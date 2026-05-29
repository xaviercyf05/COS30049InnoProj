const test = require("node:test");
const assert = require("node:assert/strict");

const envModulePath = require.resolve("../../src/config/env");

function loadEnv(overrides) {
  const keys = [
    "NODE_ENV",
    "PORT",
    "TRUST_PROXY",
    "SERVE_STATIC_CLIENT",
    "CORS_ORIGIN",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "JWT_SECRET",
    "JWT_EXPIRES_IN",
    "JWT_REMEMBER_EXPIRES_IN",
    "JWT_SESSION_REFRESH_EXPIRES_IN",
    "RICH_CONTENT_STORAGE_DIR",
    "RICH_CONTENT_MAX_FILE_SIZE_MB",
    "REQUEST_BODY_LIMIT",
  ];

  const snapshot = new Map();

  for (const key of keys) {
    snapshot.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined);
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      process.env[key] = overrides[key];
    } else {
      process.env[key] = "";
    }
  }

  delete require.cache[envModulePath];
  const loaded = require("../../src/config/env");

  for (const key of keys) {
    const previous = snapshot.get(key);
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }

  delete require.cache[envModulePath];
  return loaded;
}

test("env parser normalizes explicit values", () => {
  const env = loadEnv({
    NODE_ENV: "test",
    PORT: "4100",
    TRUST_PROXY: "yes",
    SERVE_STATIC_CLIENT: "off",
    CORS_ORIGIN: "https://example.com, https://admin.example.com ",
    DB_HOST: "db.local",
    DB_PORT: "4406",
    DB_USER: "backend",
    DB_PASSWORD: "secret",
    DB_NAME: "innopapp",
    JWT_SECRET: "unit-secret",
    JWT_EXPIRES_IN: "30m",
    JWT_REMEMBER_EXPIRES_IN: "14d",
    JWT_SESSION_REFRESH_EXPIRES_IN: "2h",
    RICH_CONTENT_STORAGE_DIR: "C:/temp/storage",
    RICH_CONTENT_MAX_FILE_SIZE_MB: "12",
    REQUEST_BODY_LIMIT: "64 MB",
  });

  assert.equal(env.nodeEnv, "test");
  assert.equal(env.port, 4100);
  assert.equal(env.trustProxy, true);
  assert.equal(env.serveStaticClient, false);
  assert.deepEqual(env.corsOrigin, ["https://example.com", "https://admin.example.com"]);
  assert.deepEqual(env.db, {
    host: "db.local",
    port: 4406,
    user: "backend",
    password: "secret",
    database: "innopapp",
  });
  assert.equal(env.jwtSecret, "unit-secret");
  assert.equal(env.jwtExpiresIn, "30m");
  assert.equal(env.jwtRememberExpiresIn, "14d");
  assert.equal(env.jwtSessionRefreshExpiresIn, "2h");
  assert.equal(env.richContentStorageDir, "C:/temp/storage");
  assert.equal(env.richContentMaxFileSizeMb, 12);
  assert.equal(env.requestBodyLimit, "64mb");
});

test("env parser falls back to defaults for blank values", () => {
  const env = loadEnv({
    NODE_ENV: "",
    PORT: "",
    TRUST_PROXY: "",
    SERVE_STATIC_CLIENT: "",
    CORS_ORIGIN: "",
    DB_HOST: "",
    DB_PORT: "",
    DB_USER: "",
    DB_PASSWORD: "",
    DB_NAME: "",
    JWT_SECRET: "",
    JWT_EXPIRES_IN: "",
    JWT_REMEMBER_EXPIRES_IN: "",
    JWT_SESSION_REFRESH_EXPIRES_IN: "",
    RICH_CONTENT_STORAGE_DIR: "",
    RICH_CONTENT_MAX_FILE_SIZE_MB: "",
    REQUEST_BODY_LIMIT: "",
  });

  assert.equal(env.nodeEnv, "development");
  assert.equal(env.port, 3000);
  assert.equal(env.trustProxy, false);
  assert.equal(env.serveStaticClient, true);
  assert.deepEqual(env.corsOrigin, []);
  assert.deepEqual(env.db, {
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    database: "appdb",
  });
  assert.equal(env.jwtSecret, "");
  assert.equal(env.jwtExpiresIn, "12h");
  assert.equal(env.jwtRememberExpiresIn, "7d");
  assert.equal(env.jwtSessionRefreshExpiresIn, "12h");
  assert.equal(env.richContentStorageDir, "");
  assert.equal(env.richContentMaxFileSizeMb, 10);
  assert.equal(env.requestBodyLimit, "25mb");
});