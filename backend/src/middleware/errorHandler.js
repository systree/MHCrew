const logger = require('../utils/logger');

/**
 * Global Express error handler.
 * Must be registered last, after all routes, in the app.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, {
    stack: err.stack,
    status: err.status || err.statusCode,
  });

  const statusCode = err.status || err.statusCode || 500;
  const message =
    statusCode < 500
      ? err.message
      : 'An unexpected error occurred. Please try again later.';

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
