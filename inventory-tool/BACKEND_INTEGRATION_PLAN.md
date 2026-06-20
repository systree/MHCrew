# Backend Integration Plan — Multi-Tenant + GHL Writeback

> **Status: PLANNED / NOT STARTED.** This is the priority backend work that makes the
> inventory-tool usable across multiple locations. It is separate from (and should land
> before) the AI photo scan in `AI_SCAN_PLAN.md`. Settle the open decisions at the bottom
> before building.

## Scope (what this app is)

A structured **item-list collector** — not a quoting tool. Estimates, move dates, access,
etc. are all handled by the operator/manager **in GHL** after they see the list. The
app's only jobs:

1. Know *who/where* a session belongs to (which location + which contact).
2. Let the client fill in their moving items without losing progress.
3. Write a clean, human-readable inventory summary back onto the GHL contact so the
   operator can read it before calling the client to quote.

## Current baseline this replaces

- Validation mocked (`WizardPage`: `setTimeout → setValid(true)`).
- Submit mocked (`ReviewStep`: 1.5s `setTimeout → navigate('/submitted')`).
- Tenant hardcoded (`mockTenant` in `data/categories.ts`).
- `items` is in-memory only (`store/inventoryStore.ts`) — refresh wipes everything.
- URL params `?c`/`?o`/`?t` captured but unused; `/invalid` route exists but is unreachable.

## Where the backend lives

Extend the existing `backend/` (Express) service. It already has: `JWT_SECRET`, the n8n
GHL-token fetch (`N8N_TOKEN_ENDPOINT` + 401-retry-once), `services/ghlOutbound.js`,
`provisionCustomFields`, and the `mh_pwa_` multi-tenant tables. A separate service would
duplicate all of it. **Do not** stand up a new service.

---

## 1. Identity — signed token, not raw IDs

Raw `?locationId=&contactId=` in the URL is unsafe — anyone could edit it and write
inventory onto any contact in any location. Instead:

- Backend mints a **JWT** (signed with existing `JWT_SECRET`) with payload
  `{ locationId, contactId, oppId?, exp }`.
- Link: `https://inventory.systree.com.au/?k=<token>` — opaque, tamper-proof,
  self-identifying.
- Replaces the mocked validation. Invalid/expired token → route to `/invalid`.

## 2. Session load — multi-tenancy + branding

On app load, replace the fake `setTimeout`:

- App calls `POST /api/inventory/session` with the token.
- Backend verifies signature/expiry, extracts `locationId` + `contactId`, returns:
  - **Tenant branding** resolved from `mh_pwa_tenants` by `location_id`
    (company name, logo, brand color, phone, email) — replaces `mockTenant`.
    Fallback to GHL location info if the row is thin.
  - **Saved draft** (see §3) to rehydrate the store.

Multi-tenancy rule: every record scoped by `location_id` (existing convention). No tenant
data is ever trusted from the client — only what the verified token resolves to.

## 3. Persistence — draft autosave + resume

- **Backend draft (primary):** debounce-save `items`/`notes` to a new
  `mh_pwa_inventory_drafts` table keyed by `location_id` + `contact_id`. Session load
  rehydrates the Zustand store from it.
  - Survives refresh, interruptions, and device switches (same link resumes anywhere).
  - Operator can see partial progress before submission.
- **localStorage (optional):** instant same-device resume before the first network save.
  Nice-to-have, not essential. Recommend skipping for v1 — it gives no operator
  visibility and breaks on a new device.

## 4. Submit → write back to GHL (core)

`POST /api/inventory/submit` with token + items + notes:

1. Verify token → `locationId`, `contactId`.
2. Fetch GHL token for that location via n8n endpoint (with 401-retry-once).
3. Format inventory into a **human-readable summary** (grouped by room, with quantities,
   plus notes) — the operator reads this before calling.
4. Write it to a **contact custom field** via GHL API (update contact `customFields`),
   resolving the field UUID for that location from `mh_pwa_location_custom_fields`.
5. Mark draft submitted; navigate to `/submitted`.

**Format:** one long-text field "Moving Inventory" holding the readable summary
(prioritized for the operator); optionally a second field with raw JSON for future
re-parsing.

## 5. Custom-field provisioning (multi-tenant gotcha)

Each location must have the "Moving Inventory" field before writing. Reuse the existing
`provisionCustomFields` in `services/ghlOutbound.js` + the `mh_pwa_location_custom_fields`
mapping: ensure the field exists for the location, cache its id, then write. No new
machinery — reuse the established pattern.

## 6. Link generation (operator side)

The token must be minted server-side, so GHL can't build it alone. Cleanest automated
flow:

- A **GHL workflow** fires a webhook to a secured backend endpoint
  `POST /api/inventory/issue-link` (shared-key protected) with `contactId` + `locationId`.
- Backend mints the token, builds the full URL, writes it into a contact custom field
  ("Inventory Link").
- The operator's SMS/email then uses that merge field to send the client the link.

Interim/simpler: an admin endpoint or button that returns a copy-paste link for one
contact.

---

## Schema / migrations (next is `022_*`)

- `022_inventory_drafts` — `mh_pwa_inventory_drafts`:
  `location_id`, `contact_id`, `opp_id`, `items JSONB`, `notes`,
  `status` (draft | submitted), timestamps; unique on (`location_id`, `contact_id`).
- Confirm/extend `mh_pwa_location_custom_fields` to cover "Moving Inventory"
  (+ "Inventory Link") fields.

## Frontend changes (inventory-tool)

- `WizardPage`: read `?k=` token, call `/session`, hydrate store + branding, real
  `/invalid` routing.
- `inventoryStore.ts`: hold `locationId`/`contactId` from token, debounced autosave to
  `/draft`, a `tenant` branding object replacing `mockTenant`.
- `ReviewStep.handleSubmit`: real `POST /submit` instead of the 1.5s fake.
- CORS: add `inventory.systree.com.au` to the backend allowlist (currently single-origin
  `FRONTEND_URL` → make multi-origin).

## Endpoint summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/inventory/session` | token (`k`) | Validate, return branding + saved draft |
| POST | `/api/inventory/draft` | token (`k`) | Debounced autosave of items/notes |
| POST | `/api/inventory/submit` | token (`k`) | Finalize → write summary to GHL contact field |
| POST | `/api/inventory/issue-link` | shared key | Mint token, write link to contact field |

## Open decisions (settle before building)

1. **Link delivery:** GHL-workflow-webhook auto-minting (recommended) or a manual admin
   "generate link" button for v1?
2. **Token expiry:** 30 days (recommended) or shorter?
3. **Custom field:** readable-summary only, or readable + raw-JSON field?
4. **Draft autosave:** backend draft (recommended) or localStorage-only for v1?
5. **`oppId`:** include in token / also update the opportunity, or contact-only?

## Security / guardrails

- Token signed + expiring; no valid token → `/invalid`. No tenant identity trusted from
  the client.
- `issue-link` endpoint protected by a shared key (not public).
- Rate-limit `session` / `draft` / `submit`.
- GHL writeback failures must surface clearly (don't silently drop a submitted inventory);
  this is NOT fire-and-forget like push notifications — the data must land.
