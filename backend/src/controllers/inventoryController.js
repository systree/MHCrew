'use strict';

const supabase = require('../services/supabase');
const logger = require('../utils/logger');
const { signInventoryToken } = require('../services/inventoryToken');
const {
  pushContactCustomField,
  pushCustomFieldUpdate,
  provisionCustomFields,
} = require('../services/ghlOutbound');

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

// ---------------------------------------------------------------------------
// POST /api/inventory/session   (token authenticated)
// Validates the link token and returns tenant branding + any saved draft so
// the SPA can hydrate. A 401 (from the auth middleware) tells the SPA to route
// the customer to /invalid.
// ---------------------------------------------------------------------------
async function getSession(req, res) {
  const { locationId, contactId } = req.inventory;

  const { data: tenant } = await supabase
    .from('mh_pwa_tenants')
    .select('company_name, is_active')
    .eq('location_id', locationId)
    .maybeSingle();

  const { data: draft } = await supabase
    .from('mh_pwa_inventory_drafts')
    .select('items, notes, status')
    .eq('location_id', locationId)
    .eq('contact_id', contactId)
    .maybeSingle();

  return res.status(200).json({
    tenant: { companyName: tenant?.company_name ?? null },
    draft: draft
      ? { items: draft.items ?? {}, notes: draft.notes ?? '', status: draft.status }
      : null,
  });
}

// ---------------------------------------------------------------------------
// POST /api/inventory/draft   (token authenticated)
// Debounced autosave of items/notes. Keyed by (location_id, contact_id).
// `status` is intentionally omitted so it isn't reset on an already-submitted row.
// ---------------------------------------------------------------------------
async function saveDraft(req, res) {
  const { locationId, contactId, oppId } = req.inventory;
  const items = req.body?.items && typeof req.body.items === 'object' ? req.body.items : {};
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';

  const { error } = await supabase
    .from('mh_pwa_inventory_drafts')
    .upsert(
      {
        location_id: locationId,
        contact_id:  contactId,
        opp_id:      oppId,
        items,
        notes,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'location_id,contact_id' }
    );

  if (error) {
    logger.error(`inventory: draft save failed for contact=${contactId} location=${locationId}: ${error.message}`);
    return res.status(500).json({ error: 'Could not save draft' });
  }

  return res.status(200).json({ ok: true });
}

// ---------------------------------------------------------------------------
// POST /api/inventory/submit   (token authenticated)
// Finalises the inventory: writes the readable summary to the contact (must
// land — throws on failure) and, best-effort, mirrors it onto the opportunity.
// Then marks the draft submitted.
// Body: { items, notes, summary }
// ---------------------------------------------------------------------------
async function submit(req, res) {
  const { locationId, contactId, oppId } = req.inventory;
  const items = req.body?.items && typeof req.body.items === 'object' ? req.body.items : {};
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';
  const summary =
    typeof req.body?.summary === 'string' && req.body.summary.trim()
      ? req.body.summary
      : buildFallbackSummary(items, notes);

  // Primary write — contact field. Throws if it doesn't land.
  await writeContactFieldEnsuring(contactId, 'contact.inventory_details', summary, locationId);

  // Best-effort mirror onto the opportunity (fire-and-forget; swallows errors).
  // The contact write above already provisioned the fields, so the opportunity
  // field UUID is cached by now.
  if (oppId) {
    pushCustomFieldUpdate(oppId, 'opportunity.inventory_details', summary, locationId)
      .catch((err) => logger.error(`inventory: opportunity mirror failed opp=${oppId}: ${err.message}`));
  }

  const { error } = await supabase
    .from('mh_pwa_inventory_drafts')
    .upsert(
      {
        location_id: locationId,
        contact_id:  contactId,
        opp_id:      oppId,
        items,
        notes,
        status:      'submitted',
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'location_id,contact_id' }
    );

  if (error) {
    // The GHL write already succeeded; log but don't fail the customer's submit.
    logger.error(`inventory: draft status update failed for contact=${contactId} location=${locationId}: ${error.message}`);
  }

  logger.info(`inventory: submitted for contact=${contactId} location=${locationId}`);
  return res.status(200).json({ ok: true });
}

// Plain-text fallback summary if the SPA didn't send a pre-formatted one.
function buildFallbackSummary(items, notes) {
  const lines = Object.entries(items || {})
    .filter(([, qty]) => Number(qty) > 0)
    .map(([name, qty]) => `- ${name} × ${qty}`);
  let out = lines.length ? lines.join('\n') : '(no items selected)';
  if (notes && notes.trim()) out += `\n\nNotes: ${notes.trim()}`;
  return out;
}

module.exports = {
  issueLink,
  getSession,
  saveDraft,
  submit,
  writeContactFieldEnsuring,
};
