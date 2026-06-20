'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

// Guards server-to-server inventory endpoints (e.g. /issue-link called by a GHL
// workflow webhook). The caller must send the shared secret in the
// `x-inventory-secret` header. Fails closed if the secret isn't configured.

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function requireInventorySecret(req, res, next) {
  const expected = process.env.INVENTORY_LINK_SECRET;

  if (!expected) {
    logger.error('requireInventorySecret: INVENTORY_LINK_SECRET is not configured — refusing request');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const provided = req.headers['x-inventory-secret'];
  if (!provided || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Invalid or missing inventory secret' });
  }

  next();
}

module.exports = requireInventorySecret;
