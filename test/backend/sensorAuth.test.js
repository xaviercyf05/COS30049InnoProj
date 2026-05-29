const test = require("node:test");
const assert = require("node:assert/strict");

const sensorModulePath = require.resolve("../../src/middleware/sensorAuth");

function loadSensorAuth(keysJson) {
  const previous = process.env.SENSOR_DEVICE_KEYS;
  if (keysJson === undefined) {
    delete process.env.SENSOR_DEVICE_KEYS;
  } else {
    process.env.SENSOR_DEVICE_KEYS = keysJson;
  }

  delete require.cache[sensorModulePath];
  const loaded = require("../../src/middleware/sensorAuth");

  if (previous === undefined) {
    delete process.env.SENSOR_DEVICE_KEYS;
  } else {
    process.env.SENSOR_DEVICE_KEYS = previous;
  }

  delete require.cache[sensorModulePath];
  return loaded;
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

test("loads default device keys when no override is configured", () => {
  const { DEVICE_KEYS } = loadSensorAuth();

  assert.equal(DEVICE_KEYS["device-Bako"], "cos30049fr");
  assert.equal(DEVICE_KEYS["device001"], "cos30049fr");
});

test("loads custom device keys from JSON override", () => {
  const { DEVICE_KEYS } = loadSensorAuth(JSON.stringify({ alpha: "one", beta: "two" }));

  assert.deepEqual(DEVICE_KEYS, { alpha: "one", beta: "two" });
});

test("validateDeviceKey accepts matching keys from headers and body", () => {
  const { validateDeviceKey } = loadSensorAuth(JSON.stringify({ kiosk01: "secret-123" }));

  const req = { headers: { "x-device-key": "secret-123", "x-device-id": "kiosk01" }, body: {} };
  const res = createResponseMock();
  let nextCalled = false;

  validateDeviceKey(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.deviceID, "kiosk01");

  const bodyReq = { headers: {}, body: { key: "secret-123", deviceID: "kiosk01" } };
  const bodyRes = createResponseMock();
  let bodyNextCalled = false;

  validateDeviceKey(bodyReq, bodyRes, () => {
    bodyNextCalled = true;
  });

  assert.equal(bodyNextCalled, true);
  assert.equal(bodyReq.deviceID, "kiosk01");
});

test("validateDeviceKey rejects missing or invalid keys", () => {
  const { validateDeviceKey } = loadSensorAuth(JSON.stringify({ kiosk01: "secret-123" }));

  const missingResponse = createResponseMock();
  validateDeviceKey({ headers: {}, body: {} }, missingResponse, () => {});
  assert.equal(missingResponse.statusCode, 401);
  assert.deepEqual(missingResponse.payload, { success: false, message: "Missing device API key" });

  const invalidResponse = createResponseMock();
  validateDeviceKey(
    { headers: { "x-device-key": "bad-key", "x-device-id": "kiosk01" }, body: {} },
    invalidResponse,
    () => {}
  );
  assert.equal(invalidResponse.statusCode, 401);
  assert.deepEqual(invalidResponse.payload, { success: false, message: "Unauthorized - invalid device key" });
});
