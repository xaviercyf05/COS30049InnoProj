const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../../src/config/db");
const app = require("../../src/app");

async function startServer() {
  return await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test("health endpoints report success when the database ping works", async () => {
  const originalGetConnection = db.pool.getConnection;
  let pingCount = 0;
  let releaseCount = 0;

  db.pool.getConnection = async () => ({
    ping: async () => {
      pingCount += 1;
    },
    release: () => {
      releaseCount += 1;
    },
  });

  const server = await startServer();

  try {
    for (const endpoint of ["/health", "/api/health"]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`);
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(payload, {
        success: true,
        message: "Server is running and database is connected.",
      });
    }

    assert.equal(pingCount, 2);
    assert.equal(releaseCount, 2);
  } finally {
    db.pool.getConnection = originalGetConnection;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("health endpoints return 503 when the database ping fails", async () => {
  const originalGetConnection = db.pool.getConnection;

  db.pool.getConnection = async () => {
    throw new Error("database unavailable");
  };

  const server = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      success: false,
      message: "Database connection failed.",
    });
  } finally {
    db.pool.getConnection = originalGetConnection;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unknown endpoints return the expected 404 payload", async () => {
  const server = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/not-a-real-route`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(payload, {
      success: false,
      message: "Endpoint not found.",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});