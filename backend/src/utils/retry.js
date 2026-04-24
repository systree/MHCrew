const logger = require('./logger');

/**
 * Retries an async function with exponential backoff.
 * @param {Function} fn           - Async function to retry. Receives the current attempt index (0-based).
 * @param {number}   maxAttempts  - Maximum number of attempts (default: 3).
 * @param {number}   baseDelayMs  - Base delay in milliseconds before the first retry (default: 500).
 * @returns {Promise<*>} Resolves with the result of fn on success.
 * @throws The last error encountered after all attempts are exhausted.
 */
async function retryWithBackoff(fn, maxAttempts = 3, baseDelayMs = 500) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        logger.warn(
          `Retry attempt ${attempt + 1}/${maxAttempts - 1} failed: ${err.message}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  logger.error(`All ${maxAttempts} attempts failed. Last error: ${lastError.message}`);
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { retryWithBackoff };
