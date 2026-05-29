const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { body } = require("express-validator");

const asyncHandler = require("../../src/utils/asyncHandler");
const validate = require("../../src/middleware/validate");
const { errorHandler, notFound } = require("../../src/middleware/errorHandler");

function createResponseMock() {
  return {
    headersSent: false,
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

async function startServer(app) {
  return await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test("asyncHandler forwards rejected async work to next", async () => {
  const wrapped = asyncHandler(async () => {
    throw new Error("boom");
  });

  let forwardedError = null;
  wrapped({}, {}, (error) => {
    forwardedError = error;
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(forwardedError instanceof Error);
  assert.equal(forwardedError.message, "boom");
});

test("asyncHandler rejects non-function handlers", () => {
  assert.throws(() => asyncHandler(null), {
    name: "TypeError",
    message: "asyncHandler: handler is not a function",
  });
});

test("validate returns a 400 response when validation fails", async () => {
  const app = express();
  app.use(express.json());
  app.post(
    "/validate",
    body("name").notEmpty().withMessage("Name is required."),
    body("age").isInt({ min: 1 }).withMessage("Age must be a positive integer."),
    validate,
    (req, res) => {
      res.json({ ok: true });
    }
  );

  const server = await startServer(app);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/validate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ age: 0 }),
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(payload, {
      message: "Validation failed.",
      errors: [
        { field: "name", message: "Name is required." },
        { field: "age", message: "Age must be a positive integer." },
      ],
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("validate allows valid requests through to the route handler", async () => {
  const app = express();
  app.use(express.json());
  app.post(
    "/validate",
    body("name").notEmpty().withMessage("Name is required."),
    validate,
    (req, res) => {
      res.json({ ok: true, name: req.body.name });
    }
  );

  const server = await startServer(app);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/validate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Guide" }),
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true, name: "Guide" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("notFound forwards a 404 error with the requested route", () => {
  let forwardedError = null;
  notFound(
    { method: "GET", originalUrl: "/missing" },
    {},
    (error) => {
      forwardedError = error;
    }
  );

  assert.ok(forwardedError instanceof Error);
  assert.equal(forwardedError.statusCode, 404);
  assert.equal(forwardedError.message, "Route not found: GET /missing");
});

test("errorHandler maps file-size and payload limits to client errors", () => {
  const fileSizeResponse = createResponseMock();
  errorHandler(Object.assign(new Error("too large"), { code: "LIMIT_FILE_SIZE" }), {}, fileSizeResponse, () => {});

  assert.equal(fileSizeResponse.statusCode, 413);
  assert.equal(fileSizeResponse.payload.message, "Profile image must be smaller than the configured file size limit.");

  const payloadResponse = createResponseMock();
  errorHandler(
    Object.assign(new Error("payload too large"), { type: "entity.too.large" }),
    {},
    payloadResponse,
    () => {}
  );

  assert.equal(payloadResponse.statusCode, 413);
  assert.equal(payloadResponse.payload.message.includes("Request payload is too large"), true);
  assert.equal(payloadResponse.payload.message.includes("Reduce embedded content size or increase REQUEST_BODY_LIMIT."), true);
});

test("errorHandler falls back to a generic 500 response", () => {
  const response = createResponseMock();
  const originalConsoleError = console.error;

  console.error = () => {};

  try {
    errorHandler(new Error("unexpected failure"), {}, response, () => {});
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.payload, { message: "Internal server error." });
});