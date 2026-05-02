const fs = require("fs");
const path = require("path");
const env = require("../../../src/config/env");

function resolveStorageDir() {
  if (env.richContentStorageDir) {
    return path.resolve(env.richContentStorageDir);
  }

  return path.resolve(__dirname, "..", "..", "..", "storage", "rich-content");
}

function ensureStorageDir() {
  const storageDir = resolveStorageDir();
  fs.mkdirSync(storageDir, { recursive: true });
  return storageDir;
}

module.exports = {
  resolveStorageDir,
  ensureStorageDir,
};
