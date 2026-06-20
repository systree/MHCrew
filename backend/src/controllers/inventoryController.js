'use strict';

const logger = require('../utils/logger');
const { signInventoryToken } = require('../services/inventoryToken');
const { pushContactCustomField, provisionCustomFields } = require('../services/ghlOutbound');

// Base URL of the customer-facing inventory-tool SPA. The signed token is
// appended as ?k=<token>.
const INVENTORY_TOOL_URL =
  process.env.INVENTORY_TOOL_URL || 'https://inventory.systree.com.au';

// ---------------------------------------------------------------------------
// writeContactFieldEnsuring
// Write a contact custom field, lazily provisioning the inventory fields once
// if the field UUID isn't cached yet (covers locations that installed before
// these fields existed). pushContactCustomField throws on failure, so a
// resolved promise here means the value actually landed in GHL.
// ---------------------------------------------------------------------------
async function writeContactFieldEnsuring(contactId, fieldKey, value, locationId) {
  try {
    await pushContactCustomField(contactId, fieldKey, value, locationId);
  } catch (err) {
    if (/No contact field UUID/.test(err.message)) {
      logger.info(`inventory: field ${fieldKey} not provisioned for location=${locationId} — provisioning then retrying`);
      await provisionCustomFields(locationId);
      await pushContactCustomField(contactId, fieldKey, value, locationId);
    } else {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/inventory/issue-link   (shared-secret protected)
// Called by a GHL workflow when an opportunity is created. Mints a signed link
// token for the contact and writes the URL to the contact's inventory_link
// field, which the operator's SMS/email merge field then reads.
// Body: { contactId, locationId, oppId? }
// ---------------------------------------------------------------------------
async function issueLink(req, res) {
  const { contactId, locationId, oppId } = req.body || {};

  if (!contactId || !locationId) {
    return res.status(400).json({ error: 'contactId and locationId are required' });
  }

  const token = signInventoryToken({ locationId, contactId, oppId });
  const url = `${INVENTORY_TOOL_URL}/?k=${token}`;

  // Must land — writeContactFieldEnsuring throws if the write fails.
  await writeContactFieldEnsuring(contactId, 'contact.inventory_link', url, locationId);

  logger.info(`inventory: issued link for contact=${contactId} location=${locationId}`);
  return res.status(200).json({ url });
}

module.exports = {
  issueLink,
  // exported for reuse by session/draft/submit (Task 6)
  writeContactFieldEnsuring,
};
