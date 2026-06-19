# Mover Hero Crew App

## Project Structure
- `backend/src/controllers/` — one file per domain (invoicesController, adminController, jobsController)
- `backend/src/routes/` — admin.js, jobs.js; timesheets has its own router with mergeParams
- `backend/src/services/ghlOutbound.js` — all outbound GHL calls + provisionCustomFields
- `backend/src/webhooks/ghlHandler.js` — all inbound GHL webhook handlers + buildJobPayload
- `frontend/src/services/api.js` — crew-facing API (jobsApi, invoicesApi, timesheetApi)
- `frontend/src/services/adminApi.js` — admin-only API calls
- `frontend/src/pages/admin/` — all admin pages
- `backend/supabase/migrations/` — sequential SQL files (next: 022_*)

## Key Conventions
- DB table prefix: `mh_pwa_` (e.g. `mh_pwa_jobs`, `mh_pwa_tenants`)
- Multi-tenant: every query scoped by `location_id`
- GHL invoice create uses `altId`/`altType` not `locationId`; `items` not `invoiceItems`
- GHL token fetched via n8n endpoint (`N8N_TOKEN_ENDPOINT`); 401 auto-retries once with fresh token
- Push notifications: fire-and-forget — never block request on notification failure
- Admin-only routes require both `requireAuth` + `requireAdmin` middleware
- Crew-accessible admin routes (e.g. invoice-settings, billing-rules) use `requireAuth` only

## Running Locally
- Backend: `npm run dev` (or `node src/index.js`) from `backend/`
- Frontend: `npm run dev` from `frontend/`
- Migration apply: `psql $DATABASE_URL < backend/supabase/migrations/<file>.sql`

## GHL API Notes
- Base URL: `https://services.leadconnectorhq.com`, Version header: `2021-07-28`
- Custom fields on opportunities returned as `[{ id, fieldValue }]` — resolve UUIDs via `mh_pwa_location_custom_fields`
- DROPDOWN custom fields need `picklistOptions` array on create
- Invoices: amount in dollars (not cents) despite docs suggesting cents
- Estimates API requires `Version: 2023-02-21` header (different from global default)
  - List: `GET /invoices/estimate/list?altId=&altType=location&contactId=&limit=10&offset=0`
  - Convert to invoice: `POST /invoices/estimate/:estimateId/invoice` with `{ altId, altType: 'location', markAsInvoiced: true, version: 'v2' }`
  - Status field is `estimateStatus` (not `status`); expiry field is `expiryDate`; number field is `estimateNumber` + `estimateNumberPrefix`
