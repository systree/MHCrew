'use strict';

const { Router } = require('express');
const requireInventorySecret = require('../middleware/inventorySecret');
const { issueLink } = require('../controllers/inventoryController');

const router = Router();

// POST /api/inventory/issue-link — mint a link token and write it to the
// contact's inventory_link field. Called server-to-server by a GHL workflow,
// protected by the shared secret (x-inventory-secret header).
router.post('/issue-link', requireInventorySecret, issueLink);

// session / draft / submit (token-authenticated) are added in Task 6.

module.exports = router;
