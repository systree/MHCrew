# Inventory Tool — Deploy & Verify Runbook (Task 8)

> Backend + frontend code is complete (Tasks 1–7). This runbook covers the
> deploy steps, the two GHL workflows, and end-to-end verification. Work top to
> bottom — later steps depend on earlier ones.

## 0. Prerequisites / what's already done

- Backend: migrations 022/023, model-aware provisioning, `pushContactCustomField`,
  inventory token service, `/issue-link` + `/session` + `/draft` + `/submit`, CORS.
- Frontend: token validation, draft autosave/resume, real submit, dynamic branding.
- The `inventory.systree.com.au` Railway service is live (root `inventory-tool`,
  `npx serve dist -s -l $PORT`, PORT 8080).

---

## 1. Apply database migrations

Run against the production DB (these are additive and safe):

```bash
psql $DATABASE_URL < backend/supabase/migrations/022_inventory_drafts.sql
psql $DATABASE_URL < backend/supabase/migrations/023_custom_field_model.sql
```

Why first: the model-aware provisioning and the field-UUID cache writes both use
the new `model` column; without it those upserts log a warning and skip.

---

## 2. Set environment variables

### Backend service (mhcrewbackend)
| Var | Value | Notes |
|-----|-------|-------|
| `INVENTORY_LINK_SECRET` | a long random string | shared secret the GHL workflow sends in `x-inventory-secret`. Generate e.g. `openssl rand -hex 32`. |
| `INVENTORY_TOOL_URL` | `https://inventory.systree.com.au` | used to build the link AND added to the CORS allowlist. No trailing slash. |

### Inventory-tool service (inventory.systree.com.au)
| Var | Value | Notes |
|-----|-------|-------|
| `VITE_API_URL` | `https://mhcrewbackend.systree.com.au/api` | **build-time** var — must be set before the build runs, then redeploy. |

> After setting `VITE_API_URL`, trigger a fresh build/deploy of the inventory-tool
> service so it's baked into the bundle.

---

## 3. Deploy

```bash
git push origin master
```

Railway rebuilds the backend and the inventory-tool services. Confirm both come
up healthy (`/health` on the backend returns `{ status: "ok" }`).

---

## 4. Provision custom fields for existing locations

New installs provision automatically. **Existing** installed locations need the
three new fields created in GHL before the workflow merge field
`{{ contact.inventory_link }}` is available in the GHL builder.

For each active location, trigger provisioning (admin-authenticated):

```
POST https://mhcrewbackend.systree.com.au/api/admin/provision-fields
Authorization: Bearer <admin JWT>
```

(or use the admin panel's provision-fields action). Confirm in GHL → Settings →
Custom Fields that these exist:
- **Contact**: `Inventory Link` (TEXT), `Moving Inventory` (LARGE_TEXT)
- **Opportunity**: `Moving Inventory` (LARGE_TEXT)

> If a location was provisioned before this change, `/issue-link` and `/submit`
> will also lazily provision on first use — but do this step up front so the
> merge field shows up when you build the workflows.

---

## 5. GHL Workflow 1 — Generate link (trigger: Opportunity Created)

1. **Trigger:** Opportunity Created (scope to the relevant pipeline if desired).
2. **Action: Webhook** (premium/custom webhook action)
   - Method: `POST`
   - URL: `https://mhcrewbackend.systree.com.au/api/inventory/issue-link`
   - Header: `x-inventory-secret: <INVENTORY_LINK_SECRET>`
   - **Custom Data** (GHL nests these under `customData` in the POST body — this is
     how GHL sends them, and what the backend reads):
     | Key | Value |
     |-----|-------|
     | `contactId` | `{{contact.id}}` |
     | `locationId` | `{{location.id}}` |
     | `oppId` | `{{opportunity.id}}` |
   - The backend reads `customData.{contactId,locationId,oppId}`, mints the token,
     writes the URL to the contact's `inventory_link` field, and returns
     `{ "url": "..." }`.

> If your GHL plan's webhook action can map the JSON response into a custom value,
> you can skip relying on the field write — but the field write is the source of
> truth and what Workflow 2 reads.

---

## 6. GHL Workflow 2 — Send link (trigger: Opportunity Stage Changed)

1. **Trigger:** Opportunity Stage Changed → set to the stage your operators move a
   deal to when they want the customer to fill in their inventory.
2. **Condition (gate):** `Inventory Link` (contact custom field) **is not empty**.
   Prevents sending an empty link if the stage is moved within ~1s of creation,
   before Workflow 1 finishes.
3. **Action: Send SMS / Email** containing the merge field:
   ```
   {{ contact.inventory_link }}
   ```
   Example SMS: `Hi {{contact.first_name}}, please list what you're moving so we
   can prepare your quote: {{ contact.inventory_link }}`

---

## 7. End-to-end verification checklist

- [ ] **Link generation:** Create a test contact + opportunity. Workflow 1 fires →
      contact's `Inventory Link` field is populated with a
      `https://inventory.systree.com.au/?k=...` URL.
- [ ] **Session + branding:** Open the link. Wizard loads (no `/invalid`), header
      shows the correct company name.
- [ ] **Draft resume:** Add a few items, wait ~2s (autosave), refresh the page →
      items are still there (loaded from the saved draft).
- [ ] **Submit:** Complete and submit. Lands on the "Thanks! All done" screen.
- [ ] **Writeback (contact):** The contact's `Moving Inventory` field shows the
      room-grouped summary + estimated m³/trucks.
- [ ] **Writeback (opportunity):** The opportunity's `Moving Inventory` field shows
      the same summary.
- [ ] **Send:** Move the opportunity to the configured stage → the customer
      receives the SMS/email with the working link.
- [ ] **Invalid link:** Open `https://inventory.systree.com.au/?k=garbage` → the
      `/invalid` page renders.

---

## 8. Troubleshooting

- **Contact `Moving Inventory`/`Inventory Link` not populating:** the GHL contact
  custom-field payload shape may need `value` instead of `field_value`. Change it
  in `backend/src/services/ghlOutbound.js → pushContactCustomField`
  (`customFields: [{ id, field_value }]` → `{ id, value }`). The write logs
  `failed` in `mh_pwa_ghl_sync_log` and throws, so this won't fail silently.
- **`/issue-link` returns 401:** the `x-inventory-secret` header doesn't match
  `INVENTORY_LINK_SECRET` (check for trailing spaces / not deployed yet).
- **`/issue-link` returns 500 "Server misconfigured":** `INVENTORY_LINK_SECRET`
  isn't set on the backend.
- **Wizard always shows `/invalid`:** token failing verification — confirm
  `JWT_SECRET` is the same value the backend used to mint it, and the link wasn't
  truncated by the SMS/email.
- **CORS errors in the browser console:** `INVENTORY_TOOL_URL` on the backend must
  exactly match the SPA origin (`https://inventory.systree.com.au`, no trailing
  slash), and the backend must have redeployed after setting it.
- **Merge field `{{ contact.inventory_link }}` missing in GHL:** run the provision
  step (§4) for that location.

---

## 9. New env vars summary (for the deployment memory)

- Backend: `INVENTORY_LINK_SECRET`, `INVENTORY_TOOL_URL`
- Inventory-tool: `VITE_API_URL`
