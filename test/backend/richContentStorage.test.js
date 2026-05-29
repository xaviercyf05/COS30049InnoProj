const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const envModulePath = require.resolve("../../src/config/env");
const storageModulePath = require.resolve("../../feature_modules/rich-content/storage");

function loadStorage(envOverrides = {}) {
  const previous = {
    RICH_CONTENT_STORAGE_DIR: process.env.RICH_CONTENT_STORAGE_DIR,
  };

  if (Object.prototype.hasOwnProperty.call(envOverrides, "RICH_CONTENT_STORAGE_DIR")) {
    process.env.RICH_CONTENT_STORAGE_DIR = envOverrides.RICH_CONTENT_STORAGE_DIR;
  } else {
    delete process.env.RICH_CONTENT_STORAGE_DIR;
  }

  delete require.cache[envModulePath];
  delete require.cache[storageModulePath];
  const storage = require("../../feature_modules/rich-content/storage");

  if (previous.RICH_CONTENT_STORAGE_DIR === undefined) {
    delete process.env.RICH_CONTENT_STORAGE_DIR;
  } else {
    process.env.RICH_CONTENT_STORAGE_DIR = previous.RICH_CONTENT_STORAGE_DIR;
  }

  delete require.cache[envModulePath];
  delete require.cache[storageModulePath];
  return storage;
}

test("resolveStorageDir uses the configured storage directory when provided", () => {
  const storage = loadStorage({ RICH_CONTENT_STORAGE_DIR: "C:/temp/rich-content" });

  assert.equal(storage.resolveStorageDir(), path.resolve("C:/temp/rich-content"));
});

test("resolveStorageDir falls back to the repository storage folder", () => {
  const storage = loadStorage({ RICH_CONTENT_STORAGE_DIR: "" });

  assert.equal(storage.resolveStorageDir(), path.resolve(__dirname, "..", "..", "..", "storage", "rich-content"));
});

test("ensureStorageDir creates the target directory recursively", () => {
  const storage = loadStorage({ RICH_CONTENT_STORAGE_DIR: "C:/temp/rich-content" });
  const originalMkdirSync = fs.mkdirSync;
  let calledWith = null;

  fs.mkdirSync = (target, options) => {
    calledWith = { target, options };
  };

  try {
    const resolved = storage.ensureStorageDir();
    assert.equal(resolved, path.resolve("C:/temp/rich-content"));
    assert.deepEqual(calledWith, {
      target: path.resolve("C:/temp/rich-content"),
      options: { recursive: true },
    });
  } finally {
    fs.mkdirSync = originalMkdirSync;
  }
});
