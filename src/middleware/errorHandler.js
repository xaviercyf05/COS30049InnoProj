const env = require("../config/env");

function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode =
    err.statusCode ||
    err.status ||
    (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);

  if (err.code === "LIMIT_FILE_SIZE") {
    err.message = "Profile image must be smaller than the configured file size limit.";
  }

  if (
    err.type === "entity.too.large" &&
    err.code !== "LIMIT_FILE_SIZE"
  ) {
    statusCode = 413;
    err.message =
      `Request payload is too large for the current API limit (${env.requestBodyLimit}). ` +
      "Reduce embedded content size or increase REQUEST_BODY_LIMIT.";
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({
    message: statusCode === 500 ? "Internal server error." : err.message,
  });
}

module.exports = {
  notFound,
  errorHandler,
};
