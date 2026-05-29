const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const envModulePath = require.resolve("../../src/config/env");
const authModulePath = require.resolve("../../src/middleware/auth");
const authUserModulePath = require.resolve("../../src/middleware/authUser");

function loadAuthModules() {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "unit-test-secret";

  delete require.cache[envModulePath];
  delete require.cache[authModulePath];
  delete require.cache[authUserModulePath];

  const auth = require("../../src/middleware/auth");
  const authUser = require("../../src/middleware/authUser");

  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }

  delete require.cache[envModulePath];
  delete require.cache[authModulePath];
  delete require.cache[authUserModulePath];

  return { auth, authUser };
}

function createResponseMock() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test("authenticateAdmin accepts admin tokens and attaches admin details", () => {
  const { auth } = loadAuthModules();
  const token = jwt.sign({ sub: 21, username: "admin01", role: "Admin" }, "unit-test-secret");
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponseMock();
  let nextCalled = false;

  auth.authenticateAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.admin, { id: 21, username: "admin01" });
});

test("authenticateAdmin rejects missing, invalid, and non-admin tokens", () => {
  const { auth } = loadAuthModules();

  const missingResponse = createResponseMock();
  auth.authenticateAdmin({ headers: {} }, missingResponse, () => {});
  assert.equal(missingResponse.statusCode, 401);
  assert.deepEqual(missingResponse.payload, { message: "Missing or invalid Authorization header." });

  const forbiddenToken = jwt.sign({ sub: 22, username: "guide", role: "User" }, "unit-test-secret");
  const forbiddenResponse = createResponseMock();
  auth.authenticateAdmin({ headers: { authorization: `Bearer ${forbiddenToken}` } }, forbiddenResponse, () => {});
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.deepEqual(forbiddenResponse.payload, { message: "Admin access required." });

  const invalidResponse = createResponseMock();
  auth.authenticateAdmin({ headers: { authorization: "Bearer invalid-token" } }, invalidResponse, () => {});
  assert.equal(invalidResponse.statusCode, 401);
  assert.deepEqual(invalidResponse.payload, { message: "Invalid or expired token." });
});

test("authenticateUser accepts both user and admin tokens", () => {
  const { authUser } = loadAuthModules();
  const token = jwt.sign({ sub: 31, username: "guide01", role: "User" }, "unit-test-secret");
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponseMock();
  let nextCalled = false;

  authUser.authenticateUser(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { userId: 31, username: "guide01", role: "User" });

  const adminToken = jwt.sign({ sub: 32, username: "admin02", role: "Admin" }, "unit-test-secret");
  const adminReq = { headers: { authorization: `Bearer ${adminToken}` } };
  const adminRes = createResponseMock();
  let adminNextCalled = false;

  authUser.authenticateUser(adminReq, adminRes, () => {
    adminNextCalled = true;
  });

  assert.equal(adminNextCalled, true);
  assert.deepEqual(adminReq.user, { userId: 32, username: "admin02", role: "Admin" });
});

test("authenticateUser and authenticateAdminOnly reject unauthorized roles", () => {
  const { authUser } = loadAuthModules();
  const token = jwt.sign({ sub: 33, username: "guest01", role: "Guest" }, "unit-test-secret");

  const userResponse = createResponseMock();
  authUser.authenticateUser({ headers: { authorization: `Bearer ${token}` } }, userResponse, () => {});
  assert.equal(userResponse.statusCode, 403);
  assert.deepEqual(userResponse.payload, {
    success: false,
    message: "Access denied. Valid user or admin role required.",
  });

  const adminOnlyResponse = createResponseMock();
  authUser.authenticateAdminOnly({ headers: { authorization: `Bearer ${token}` } }, adminOnlyResponse, () => {});
  assert.equal(adminOnlyResponse.statusCode, 403);
  assert.deepEqual(adminOnlyResponse.payload, { success: false, message: "Admin access required." });
});
