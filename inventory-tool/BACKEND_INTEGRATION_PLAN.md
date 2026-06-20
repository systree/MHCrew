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

## 6. Link generation + delivery (two-workflow design)

A GHL workflow can't mint the signed token itself, so the backend mints it and writes the
URL onto the contact. Delivery is split into **two separate GHL workflows** so there is no
timing race (the link is written at opportunity creation, long before it is sent):

**Workflow 1 — Generate link** (trigger: *opportunity created*)
- Webhook action → `POST /api/inventory/issue-link` with `{ contactId: {{contact.id}},
  locationId: {{location.id}}, oppId: {{opportunity.id}} }` + shared-secret header.
- Backend mints JWT `{ locationId, contactId, oppId, exp: 30d }`, builds
  `https://inventory.systree.com.au/?k=<token>`, writes it to the contact's
  `inventory_link` field (via `pushContactCustomField`), returns `200 { url }`.
- **Trigger on opportunity (not contact) creation** so the token carries `oppId` — required
  because the submitted inventory is written to BOTH the contact and the opportunity field.

**Workflow 2 — Send link** (trigger: *opportunity stage moved*)
- Condition gate: `inventory_link` is not empty (guards the rare case where a stage is
  moved within ~1s of opp creation, before the field is populated).
- Send SMS/Email containing the `{{ contact.inventory_link }}` merge field.

> The split removes the need for a `Wait` step: the field is populated at opp-creation and
> the send happens later on a deliberate stage move.

Interim/simpler fallback: an admin endpoint/button that returns a copy-paste link for one
contact (no workflow needed).

---

## 7. Custom field provisioning + writeback (GHL mechanism)

The existing `provisionCustomFields()` in `services/ghlOutbound.js` already does the correct
**check-by-fieldKey, create-if-missing, idempotent** pattern — but every current field is
`model: 'opportunity'`. Inventory needs a **contact** field too, and GHL custom fields are
model-scoped, so three opportunity-only pieces need a contact-aware path:

1. **Provisioning** — `provisionCustomFields` hardcodes `model: 'opportunity'` (GET + POST).
   Generalize: add a `model` property per `REQUIRED_FIELDS` entry (default `'opportunity'`),
   fetch existing fields per model, create with the correct model.
2. **UUID cache** — `getFieldKeyMap()` (`webhooks/ghlHandler.js`) only fetches
   `model: 'opportunity'`, so a contact field's UUID never lands in
   `mh_pwa_location_custom_fields`. Extend it to also fetch `model: 'contact'`, AND have
   `provisionCustomFields` upsert each created field's `id` immediately (don't depend on the
   daily lazy sync).
3. **Writer** — `pushCustomFieldUpdate()` writes `PUT /opportunities/:id`. Add a new
   `pushContactCustomField(contactId, fieldKey, value, locationId)` that writes
   `PUT /contacts/:id` with `customFields: [{ id, field_value }]` (verify contact payload
   shape vs opportunity — may be `value` not `field_value`). Reuses `getGhlClient`,
   `retryWithBackoff`, `logOutbound`, 401-retry.

**Match by `fieldKey`, not display name** — GHL keys are stable; display names can be renamed
in the GHL UI and break a name match. ("Check by name" → in practice check by fieldKey.)

### Three provisioned fields

| Field key | Model | Type | Written by | Holds |
|-----------|-------|------|-----------|-------|
| `inventory_link` | contact | TEXT | `/issue-link` | the wizard URL (SMS/email merge field reads this) |
| `inventory_details` | contact | LARGE_TEXT | `/submit` | readable inventory summary |
| `inventory_details` | opportunity | LARGE_TEXT | `/submit` | same summary, on the opportunity |

> Both `inventory_details` writes happen on submit (contact + opportunity). Format is a
> readable summary only (rooms → items × qty, notes, estimated m³ + suggested 4.5t trucks).
> This write is NOT fire-and-forget — failures must surface.

### Provision timing
- **Install-time:** add the three fields to `provisionCustomFields` (runs on app install).
- **Submit-time lazy ensure:** also ensure the fields exist on first `/submit`, covering
  locations that installed before these fields existed.

---

## Schema / migrations (next is `022_*`)

- `022_inventory_drafts` — `mh_pwa_inventory_drafts`:
  `location_id`, `contact_id`, `opp_id`, `items JSONB`, `notes`,
  `status` (draft | submitted), timestamps; unique on (`location_id`, `contact_id`).
- `023_custom_field_model` — add `model` column to `mh_pwa_location_custom_fields`
  (default `'opportunity'`, backfill existing rows). Needed because a contact and an
  opportunity field can share a key (`inventory_details`); the writer disambiguates by
  model. Unique key stays `(location_id, field_id)`.

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
| POST | `/api/inventory/submit` | token (`k`) | Finalize → write summary to contact + opportunity fields |
| POST | `/api/inventory/issue-link` | shared key | Mint token, write link to contact `inventory_link` field |

## Resolved decisions

1. **Field model:** BOTH contact and opportunity (`inventory_details` on each).
2. **Format:** readable LARGE_TEXT summary only (no raw-JSON field).
3. **Field name/key:** "Moving Inventory" / `inventory_details`; link field `inventory_link`.
4. **Provision timing:** install-time + submit-time lazy ensure.
5. **Link delivery:** GHL two-workflow design (generate on opp-created, send on stage-move).
6. **Token expiry:** 30 days.
7. **Draft autosave:** backend draft (not localStorage-only).

## Security / guardrails

- Token signed + expiring; no valid token → `/invalid`. No tenant identity trusted from
  the client.
- `issue-link` endpoint protected by a shared key (not public).
- Rate-limit `session` / `draft` / `submit`.
- GHL writeback failures must surface clearly (don't silently drop a submitted inventory);
  this is NOT fire-and-forget like push notifications — the data must land.

---

## Build task list

### Phase 1 — Schema & custom fields (backend foundation)
- [ ] 1.1 Migration `022_inventory_drafts` — create `mh_pwa_inventory_drafts`.
- [ ] 1.2 Migration `023_custom_field_model` — add `model` column to
      `mh_pwa_location_custom_fields` (default `'opportunity'`, backfill).
- [ ] 1.3 Generalize `provisionCustomFields` to be model-aware; add the three inventory
      fields (`inventory_link` contact, `inventory_details` contact + opportunity).
- [ ] 1.4 Have `provisionCustomFields` upsert each created field's `id`/`model` into
      `mh_pwa_location_custom_fields`.
- [ ] 1.5 Extend `getFieldKeyMap` to also fetch `model: 'contact'`.

### Phase 2 — GHL writers
- [ ] 2.1 Add `pushContactCustomField(contactId, fieldKey, value, locationId)` (writes
      `PUT /contacts/:id`); verify contact payload shape vs opportunity.
- [ ] 2.2 Confirm `pushCustomFieldUpdate` (opportunity) works for `inventory_details`.

### Phase 3 — Token & endpoints
- [ ] 3.1 Token helper: mint/verify JWT `{ locationId, contactId, oppId, exp: 30d }`.
- [ ] 3.2 `POST /api/inventory/issue-link` (shared-secret) → mint + write `inventory_link`.
- [ ] 3.3 `POST /api/inventory/session` (token) → verify, return branding + saved draft.
- [ ] 3.4 `POST /api/inventory/draft` (token) → upsert draft.
- [ ] 3.5 `POST /api/inventory/submit` (token) → format summary, lazy-ensure fields, write
      to contact + opportunity, mark draft submitted. NOT fire-and-forget.
- [ ] 3.6 Shared-secret middleware (`INVENTORY_LINK_SECRET`) + rate-limit session/draft/submit.
- [ ] 3.7 Add `inventory.systree.com.au` to backend CORS allowlist (multi-origin).

### Phase 4 — Frontend wiring (inventory-tool)
- [ ] 4.1 `WizardPage`: read `?k=` token, call `/session`, real `/invalid` routing.
- [ ] 4.2 Store: hold `locationId`/`contactId`/token, branding object replacing `mockTenant`,
      debounced autosave to `/draft`.
- [ ] 4.3 `ReviewStep.handleSubmit`: real `POST /submit` (replace 1.5s fake), include the
      computed m³ + truck estimate in the payload/summary.
- [ ] 4.4 Hydrate saved draft on load.

### Phase 5 — GHL workflows (config, in GHL UI)
- [ ] 5.1 Workflow 1: opp-created → webhook → `/issue-link` (with secret header).
- [ ] 5.2 Workflow 2: stage-move → condition `inventory_link` not empty → send SMS/Email.

### Phase 6 — Verify end-to-end
- [ ] 6.1 New contact+opp → link generated → field populated.
- [ ] 6.2 Open link → session validates, branding loads, draft resumes.
- [ ] 6.3 Submit → summary lands on contact + opportunity fields.
- [ ] 6.4 Expired/invalid token → `/invalid`.
