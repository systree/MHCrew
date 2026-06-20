# AI Photo Scan — Future Plan

> **Status: FUTURE / NOT STARTED.** This is a large, multi-phase feature, captured
> here for later. Nothing in this document is built yet. Review the open questions
> at the bottom before scheduling any work.

## Goal

Let a customer photograph their rooms/items, have an AI vision model identify each
item, attach real-world dimensions + weight, and compute **total volume → recommended
truck size**. Modeled on the LiveSwitch AI-survey approach (https://www.liveswitch.com/),
but photo-based and bolted onto the existing inventory wizard.

## Current state (baseline this builds on)

The inventory-tool is a static Vite/React SPA with **no backend wiring**:
- Validation is mocked (`WizardPage`: `setTimeout → setValid(true)`).
- Submit is mocked (`ReviewStep`: 1.5s `setTimeout → navigate('/submitted')`).
- Tenant is hardcoded (`mockTenant` in `data/categories.ts`).
- `items` is a flat `Record<itemName, qty>` in `store/inventoryStore.ts`.
- URL params `?c=` (contactId), `?o=` (oppId), `?t=` (tenantSlug) are captured but unused.

This feature introduces the **first real backend integration** for the tool.

## Key architectural decision

The OpenRouter API key **must live server-side only** — the inventory-tool is a static
bundle, so any key would be exposed. All AI calls route through the existing `backend/`
(Express) service, which already has GHL/auth/token plumbing. Consequence: the new
`inventory.systree.com.au` origin must be added to the backend CORS allowlist
(`FRONTEND_URL` currently allows a single origin → make it multi-origin).

## Accuracy strategy (shapes the whole design)

Vision models are great at **recognizing** items but unreliable at **precise
dimensions/weight**. The moving industry solves this with a **"cube sheet"** — a lookup
table of standard volume/weight per furniture type. So the design is a hybrid:

- **AI's job:** identify items in the photo, map each to our existing `categories`
  taxonomy (`data/categories.ts`), count quantity, flag anything not in the catalog.
- **Cube sheet's job:** supply trusted dimensions/weight/volume per catalog item.
- **AI fallback:** for non-catalog/unknown items, the model estimates L×W×H + weight,
  clearly marked "estimated" for the customer to confirm.

This keeps totals defensible and cheap, and turns AI errors into "confirm this list"
rather than "trust this number."

## Phases

### Phase 1 — Reference data (the cube sheet)
- New `src/data/dimensions.ts` (backend mirror or shared JSON): for every item in
  `categories.ts`, add `{ lengthCm, widthCm, heightCm, weightKg, volumeM3 }`.
  Volume in m³ (AU market) with a packing/irregularity factor (~1.3–1.5×).
- Truck-size mapping table: total m³ → recommended vehicle
  (van / 4.5t / 8t / 12t pantech). This produces the "total space required" output.

### Phase 2 — Backend AI endpoint
- `backend/src/services/openrouterVision.js` — wraps the OpenRouter call with a
  vision-capable model. Sends image(s) + a strict prompt returning **structured JSON
  only** (item name, matched catalog id or null, quantity, confidence, estimated dims
  only when unmatched).
- `backend/src/controllers/inventoryController.js`:
  - `POST /api/inventory/analyze` — accepts image(s), calls OpenRouter, maps results
    against the cube sheet, returns normalized items + running volume.
  - `POST /api/inventory/submit` — replaces the mocked submit; persists final inventory
    and pushes to GHL using the `c`/`o`/`t` params.
- Route registration + CORS change.
- **Guardrails:** server-side image size cap, content-type allowlist, per-request image
  count limit, request timeout, hard fallback to manual entry on AI failure/low
  confidence. Decide: discard images after analysis (privacy default) vs. store in
  Supabase storage (dispute trail).
- **Model:** OpenRouter can route to a high-quality multimodal model (better recognition,
  higher cost) or a cheaper open vision model. Recommend starting with a strong Claude
  vision model via OpenRouter for recognition quality, with the cube sheet doing the
  numeric work so token cost stays low. Verify model id + live pricing on OpenRouter
  before committing.

### Phase 3 — Frontend capture UX
- Camera input: `<input type="file" accept="image/*" capture="environment">` (native
  camera, simplest; no getUserMedia to start). Allow multiple photos per room.
- Client-side compression: downscale via canvas before upload — cuts bandwidth and token
  cost; non-negotiable for cost control.
- New "Scan the room" step in the wizard (`WizardPage` drives steps by integer index, so
  it slots in cleanly — either a dedicated step or a per-`CategoryStep` "📷 Snap instead
  of tapping" affordance). AI's detected items **pre-fill the existing `items` map**, then
  the customer verifies/edits with the current `ItemRow` steppers (AI first pass, human
  confirms — the LiveSwitch pattern).

### Phase 4 — Store + results
- Extend `inventoryStore.ts`: per-item dims/weight/volume (from cube sheet) + selectors
  `getTotalVolume()`, `getTotalWeight()`, `getRecommendedTruck()`.
- Add a **volume summary** to `ReviewStep` (and/or a new final step):
  "≈ X m³ across N rooms → recommended: 8t truck," weight as secondary info. This is the
  headline deliverable mirroring LiveSwitch.

### Phase 5 — Tie off the mocks
- Real link validation (replace `setTimeout → setValid(true)`); invalid/expired `t`/`c`
  routes to `/invalid`.
- Real submit → `POST /api/inventory/submit`, carrying items + computed volume + notes
  into GHL.

## Open questions (decide before building)
1. **Units:** m³ + kg (AU) — confirm?
2. **Photos:** retained or discarded after analysis?
3. **Capture model:** snap-per-room that pre-fills the catalog (recommended), vs.
   free-form "photograph everything" pile that AI itemizes from scratch?
4. **Backend home:** extend existing mhcrew `backend/` (recommended — reuses GHL/auth/
   token plumbing) vs. a separate tiny inventory service?
5. **Model + budget:** quality-first (Claude vision via OpenRouter) vs. cheapest open
   vision model — sets cost per scan.

## Cost / risk notes
- Per-scan cost is dominated by image tokens → compression + image count limits matter.
- Always keep manual entry as the working path; AI is an accelerator, never a hard
  dependency.
- Privacy: customer home photos are sensitive — default to discard-after-analysis unless
  there's a clear retention reason.
