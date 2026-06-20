'use strict';

const { Router } = require('express');
const requireInventorySecret = require('../middleware/inventorySecret');
const requireInventoryToken = require('../middleware/inventoryAuth');
const rateLimit = require('../middleware/rateLimit');
const { issueLink, getSession, saveDraft, submit } = require('../controllers/inventoryController');

const router = Router();

// Per-IP abuse guard for the customer-facing endpoints (generous — draft saves
// are debounced but can still be frequent during active editing).
const customerLimiter = rateLimit({ windowMs: 60_000, max: 120 });

// POST /api/inventory/issue-link — mint a link token and write it to the
// contact's inventory_link field. Called server-to-server by a GHL workflow,
// protected by the shared secret (x-inventory-secret header).
router.post('/issue-link', requireInventorySecret, issueLink);

// Customer-facing, authenticated by the signed link token (?k= / Bearer / body).
router.post('/session', customerLimiter, requireInventoryToken, getSession);
router.post('/draft',   customerLimiter, requireInventoryToken, saveDraft);
router.post('/submit',  customerLimiter, requireInventoryToken, submit);

module.exports = router;
