function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    err.statusCode ||
    err.status ||
    (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);

  if (err.code === "LIMIT_FILE_SIZE") {
    err.message = "Profile image must be smaller than the configured file size limit.";
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
