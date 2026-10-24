function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const isJsonParseError =
    error instanceof SyntaxError &&
    Object.prototype.hasOwnProperty.call(error, "body");

  if (isJsonParseError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    });
  }

  console.error("Unhandled API error:", {
    method: req.method,
    path: req.originalUrl,
    message: error.message,
    code: error.code,
  });

  if (process.env.NODE_ENV !== "production") {
    console.error(error.stack);
  }

  const status = Number(error.status) || Number(error.statusCode) || 500;
  const isServerError = status >= 500;

  return res.status(status).json({
    success: false,
    error: {
      code: isServerError
        ? "INTERNAL_SERVER_ERROR"
        : error.code || "REQUEST_FAILED",
      message: isServerError
        ? "An unexpected error occurred."
        : error.message || "Request failed.",
    },
  });
}

module.exports = errorHandler;
