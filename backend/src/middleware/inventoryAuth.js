'use strict';

const { verifyInventoryToken } = require('../services/inventoryToken');

// Authenticates the customer-facing inventory endpoints (session/draft/submit).
// The signed link token may arrive as `Authorization: Bearer <token>`, a `token`
// field in the JSON body, or a `k` query param. On success the resolved
// { locationId, contactId, oppId } is attached to req.inventory.
//
// A 401 here is the signal the SPA uses to route the customer to /invalid.
function requireInventoryToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearer || req.body?.token || req.query?.k;

  if (!token) {
    return res.status(401).json({ error: 'Missing inventory token', code: 'invalid_token' });
  }

  try {
    req.inventory = verifyInventoryToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'invalid_token' });
  }
}

module.exports = requireInventoryToken;
