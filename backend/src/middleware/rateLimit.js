'use strict';

// Minimal in-memory fixed-window rate limiter — no external dependency.
// NOTE: per-process only; with multiple Railway instances each has its own
// window. Good enough as a basic abuse guard; swap for a shared store if you
// need strict global limits.

function rateLimit({ windowMs = 60_000, max = 120, key } = {}) {
  const hits = new Map(); // id -> { count, resetAt }

  return function rateLimiter(req, res, next) {
    const id = (key ? key(req) : null) || req.ip || 'global';
    const now = Date.now();
    let entry = hits.get(id);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests' });
    }

    next();
  };
}

module.exports = rateLimit;
