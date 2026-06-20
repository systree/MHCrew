'use strict';

const jwt = require('jsonwebtoken');

// Signed link token for the inventory-tool app. Distinct from the crew session
// token: it carries the GHL contact/opportunity a submission belongs to, and a
// `typ: 'inventory'` claim so a crew session token can't be used here (or vice
// versa). Minted by /api/inventory/issue-link, verified by session/draft/submit.

const TOKEN_TYPE   = 'inventory';
const EXPIRES_IN   = '30d'; // links are sent by SMS/email and may sit for weeks

/**
 * Mint an inventory link token.
 * @param {{ locationId: string, contactId: string, oppId?: string }} claims
 * @returns {string} signed JWT
 */
function signInventoryToken({ locationId, contactId, oppId = null }) {
  if (!locationId || !contactId) {
    throw new Error('signInventoryToken: locationId and contactId are required');
  }
  return jwt.sign(
    { typ: TOKEN_TYPE, locationId, contactId, oppId },
    process.env.JWT_SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

/**
 * Verify an inventory link token.
 * @param {string} token
 * @returns {{ locationId: string, contactId: string, oppId: string|null }}
 * @throws if missing, malformed, expired, or not an inventory token
 */
function verifyInventoryToken(token) {
  if (!token) throw new Error('Missing token');

  const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws on invalid/expired
  if (decoded.typ !== TOKEN_TYPE) {
    throw new Error('Not an inventory token');
  }
  return {
    locationId: decoded.locationId,
    contactId:  decoded.contactId,
    oppId:      decoded.oppId ?? null,
  };
}

module.exports = { signInventoryToken, verifyInventoryToken };
