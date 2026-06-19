# Developer Guide

This guide is for developers joining the Mover Hero Crew App project. It assumes familiarity with Node.js, React, and PostgreSQL. For system-level context, read [System Overview.md](System%20Overview.md) and [Architecture.md](Architecture.md) first.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Local Development Setup](#2-local-development-setup)
3. [Database](#3-database)
4. [Auth System](#4-auth-system)
5. [Backend Architecture](#5-backend-architecture)
6. [GHL Integration](#6-ghl-integration)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Push Notifications](#8-push-notifications)
9. [Key Business Logic](#9-key-business-logic)
10. [Extension Points](#10-extension-points)
11. [Common Gotchas and Design Decisions](#11-common-gotchas-and-design-decisions)

---

## 1. Project Structure

```
mhcrewapp/
├── backend/
│   ├── index.js                      # Express entry point, middleware, server init
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── adminController.js    # Admin-only logic (pipeline, crew, billing, jobs)
│   │   │   ├── invoicesController.js # Invoice + estimate CRUD via GHL API
│   │   │   ├── jobsController.js     # Crew job list, detail, status transitions
│   │   │   ├── authController.js     # OTP, PIN, JWT auth
│   │   │   ├── timesheetController.js
│   │   │   ├── photosController.js
│   │   │   ├── locationsController.js
│   │   │   └── notificationController.js
│   │   ├── routes/
│   │   │   ├── index.js              # Aggregates all route modules under /api
│   │   │   ├── admin.js              # /api/admin/* routes
│   │   │   ├── jobs.js               # /api/jobs/* routes (includes invoice sub-routes)
│   │   │   ├── auth.js
│   │   │   ├── timesheets.js         # mergeParams router, mounted at /jobs/:jobId/timesheets
│   │   │   ├── photos.js
│   │   │   ├── locations.js
│   │   │   ├── notifications.js
│   │   │   └── webhooks.js           # /webhooks — mounted before express.json() for raw body
│   │   ├── services/
│   │   │   ├── ghl.js                # getGhlClient() — axios instance + 3-stage auth fallback
│   │   │   ├── ghlTokenService.js    # OAuth token fetch + 20-min in-memory cache
│   │   │   ├── pitTokenService.js    # PIT token fetch + indefinite cache
│   │   │   ├── ghlOutbound.js        # All outbound GHL calls + provisionCustomFields
│   │   │   ├── pushService.js        # Web push via web-push (notifyUser, notifyAdmins)
│   │   │   ├── supabase.js           # Supabase client (service key)
│   │   │   └── mobilemessage.js      # SMS OTP delivery
│   │   ├── webhooks/
│   │   │   └── ghlHandler.js         # Inbound GHL webhook router + per-event handlers
│   │   ├── middleware/
│   │   │   ├── auth.js               # requireAuth — JWT verification
│   │   │   ├── errorHandler.js
│   │   │   └── validate.js
│   │   └── utils/
│   │       ├── logger.js             # Winston logger + logActivity() DB helper
│   │       ├── stageStatusMap.js     # GHL stage name → PWA job_status mapping
│   │       ├── dateUtils.js          # parseScheduledDate with timezone support
│   │       └── retry.js              # retryWithBackoff()
│   ├── supabase/
│   │   └── migrations/               # Sequential SQL files — 001_enums.sql … 020_*
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx                   # BrowserRouter, route declarations, ProtectedRoute/AdminRoute
    │   ├── store/
    │   │   └── authStore.js          # Zustand auth store (persisted to localStorage)
    │   ├── services/
    │   │   ├── api.js                # Crew-facing axios instance + typed endpoint helpers
    │   │   └── adminApi.js           # Admin-only API calls
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── JobDetailPage.jsx
    │   │   ├── CreateInvoicePage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   └── admin/                # All admin-only pages
    │   ├── components/               # Shared UI components, OfflineBanner, UpdateBanner
    │   ├── hooks/                    # useSyncQueue and other custom hooks
    │   └── utils/
    │       └── formatters.js         # Date/time formatters; holds timezone via setTimezone()
    └── public/
        └── sw-custom.js              # Service worker (PWA caching + update detection)
```

---

## 2. Local Development Setup

### Prerequisites

- Node.js 18+
- A Supabase project with migrations applied
- A GHL Marketplace App installed on a test sub-account
- An n8n instance serving the token endpoints (or mock them locally)

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in all values:

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default `3001`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (bypasses RLS) |
| `GHL_API_BASE_URL` | `https://services.leadconnectorhq.com` |
| `GHL_APP_ID` | GHL Marketplace App ID |
| `N8N_TOKEN_ENDPOINT` | n8n webhook URL that returns `{ access_token }` |
| `GHL_WEBHOOK_PUBLIC_KEY` | Ed25519 PEM public key from GHL app settings (newlines as `\n`) |
| `JWT_SECRET` | Random secret for signing session JWTs |
| `MOBILEMESSAGE_API_KEY` | MobileMessage SMS API key |
| `OTP_BYPASS_PHONES` | Comma-separated phone numbers that skip SMS and log OTP to console |
| `VAPID_PUBLIC_KEY` | Web push public key (generate once with `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Web push private key |
| `VAPID_SUBJECT` | `mailto:` or `https:` contact for VAPID |
| `GHL_PIT_NAME` | Name of the Private Integration Token in GHL (e.g. `Master`) |

For the frontend, create `frontend/.env` (or `.env.development`):

```
VITE_API_URL=http://localhost:3001/api
```

> **Port note:** `vite.config.js` has a dev proxy that routes `/api` to `http://localhost:8000`. If you set `VITE_API_URL` explicitly (as above), it overrides the proxy and hits the backend directly on port 3001. Either approach works — just make sure the backend `PORT` env var matches whichever port you use.

### Running Locally

```bash
# Backend
cd backend
npm install
npm run dev        # or: node index.js

# Frontend
cd frontend
npm install
npm run dev
```

The backend entry point is `backend/index.js` (in the repo root of the backend folder, not inside `src/`). The webhook route is registered **before** `express.json()` so raw body capture works for signature verification.

### Local Webhook Testing

GHL webhooks are sent to a public URL. During local development you need a tunnel to expose `localhost:3001` to the internet. Use [ngrok](https://ngrok.com/) or a similar tool:

```bash
ngrok http 3001
```

Set the resulting public URL as the webhook endpoint in your GHL Marketplace App settings (e.g. `https://abc123.ngrok.io/api/webhooks/ghl`). Update `GHL_WEBHOOK_PUBLIC_KEY` in `.env` with the Ed25519 public key from those same GHL app settings.

---

## 3. Database

### Supabase / PostgreSQL

The backend uses the Supabase JavaScript client with the **service role key**, which bypasses Row Level Security. All data isolation is enforced in application code by scoping every query with `location_id`.

### Table Prefix

All tables use the `mh_pwa_` prefix (e.g. `mh_pwa_jobs`, `mh_pwa_tenants`, `mh_pwa_crew_users`). This prevents naming collisions if the schema is shared with other apps.

### Migration Convention

Migrations live in `backend/supabase/migrations/` and are named sequentially:

```
001_enums.sql
002_tables.sql
...
020_show_estimates.sql
```

The next migration must be named `021_*.sql`. There is no migration runner — apply manually:

```bash
psql $DATABASE_URL < backend/supabase/migrations/021_your_change.sql
```

Each file should be idempotent where possible (use `IF NOT EXISTS`, `IF EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### Core Tables

| Table | Purpose |
|---|---|
| `mh_pwa_tenants` | One row per GHL sub-account; stores pipeline, timezone, invoice settings, billing rules |
| `mh_pwa_crew_users` | All users who can log in; keyed by phone + `ghl_user_id` |
| `mh_pwa_jobs` | Moving jobs sourced from GHL opportunities |
| `mh_pwa_job_crew_assignments` | Many-to-many: jobs ↔ crew members |
| `mh_pwa_timesheets` | Clock-in/clock-out per crew member per job |
| `mh_pwa_job_photos` | Photos captured on-site |
| `mh_pwa_job_locations` | GPS pings keyed to job + trigger event |
| `mh_pwa_otp_tokens` | Short-lived OTP hashes (10 min TTL) |
| `mh_pwa_pipeline_stages` | GHL pipeline stages with optional `job_status` mapping |
| `mh_pwa_location_custom_fields` | Cache of GHL custom field UUID → key mappings |
| `mh_pwa_push_subscriptions` | Web push endpoint/key pairs per user |
| `mh_pwa_ghl_sync_log` | Audit log of every inbound and outbound GHL sync event |
| `mh_pwa_activity_log` | Structured application event log |

### Multi-Tenancy Pattern

Every tenant is a GHL sub-account identified by `location_id`. Every query that touches tenant data must include `.eq('location_id', locationId)`. The `locationId` comes from `req.user.locationId` — it is embedded in the JWT at login time and cannot be spoofed.

Example pattern:
```js
const { data } = await supabase
  .from('mh_pwa_jobs')
  .select('*')
  .eq('location_id', req.user.locationId)   // always scope by tenant
  .eq('id', jobId);
```

---

## 4. Auth System

There is **no Supabase Auth**. The system uses a custom two-factor flow:

```
First login:       phone → OTP via SMS → set 4-digit PIN
Subsequent logins: phone → OTP via SMS → enter PIN
```

> The frontend UI always requires OTP before PIN, even for returning users. The `POST /auth/login-pin` endpoint can be called directly with phone + PIN, but the current frontend always calls it after a successful `POST /auth/verify-otp`. PIN is a second factor, not a replacement for OTP.

### OTP Flow (`authController.js`)

1. `POST /auth/send-otp` — generates a 6-digit OTP, SHA-256 hashes it, stores the hash in `mh_pwa_otp_tokens` with a 10-minute TTL, sends raw OTP via MobileMessage SMS.
2. `POST /auth/verify-otp` — fetches the unexpired token, compares hashes with `crypto.timingSafeEqual`, marks used, returns JWT + `requiresPinSetup` flag.
3. `POST /auth/setup-pin` — bcrypt-hashes the PIN, stores in `mh_pwa_crew_users.pin_hash`.
4. `POST /auth/login-pin` — fetches user by phone, bcrypt-compares PIN, returns JWT.

Development bypass: phones listed in `OTP_BYPASS_PHONES` always get OTP `123456` and no SMS is sent.

### JWT Structure

```json
{
  "userId":     "uuid",
  "phone":      "+61412345678",
  "role":       "admin | crew | lead",
  "locationId": "ghl-location-id",
  "iat": 0,
  "exp": 0
}
```

Tokens expire after **30 days**. The `locationId` is embedded at login from `mh_pwa_crew_users.location_id` and drives all tenant scoping downstream.

### Middleware

**`requireAuth`** (`middleware/auth.js`): Verifies `Authorization: Bearer <token>`, decodes it, attaches payload to `req.user`. Returns 401 on failure.

**`requireAdmin`** (`adminController.js`): Checks `req.user.role === 'admin'`. Returns 403 otherwise. This is a plain function, not a separate file — it is exported alongside the admin controllers.

### Role Distinction

| Route category | Middleware |
|---|---|
| Admin-only routes (crew management, sync, notifications) | `requireAuth` + `requireAdmin` |
| Crew-accessible admin routes (invoice-settings, billing-rules GET) | `requireAuth` only |
| All crew routes | `requireAuth` only |

The `invoice-settings` and `billing-rules` GET endpoints are intentionally open to all authenticated users because crew members need tax settings and callout minutes when creating invoices.

---

## 5. Backend Architecture

### Layering

```
Route → Controller → Service → (Supabase / GHL API)
```

Routes handle HTTP method/path matching and middleware chaining. Controllers own request/response and business validation. Services encapsulate external I/O (Supabase client, GHL API client).

### Key Controllers

**`jobsController.js`**
- `getMyJobs` — queries crew assignments then joins to jobs; scoped by `location_id`
- `getJobById` — verifies assignment, returns full job row
- `updateJobStatus` — validates state machine transitions (`assigned → enroute → arrived → in_progress → completed | cancelled`), persists to DB, fires GHL outbound calls and push notifications as fire-and-forget

**`invoicesController.js`**
- `createJobInvoice` — builds full GHL invoice payload (contact details, business details from tenant, tax from invoice settings), calls GHL create, then immediately auto-sends via GHL send endpoint. Push notification to admins is fire-and-forget.
- `createInvoiceFromEstimate` — auto-accepts the estimate first (GHL requires `estimateStatus=accepted`), then converts via `POST /invoices/estimate/:id/invoice`
- `getJobEstimates` / `recordJobPayment` — thin wrappers around GHL API

**`adminController.js`**
- Pipeline/stage configuration stored in `mh_pwa_tenants` and `mh_pwa_pipeline_stages`
- `syncJobs` / `syncCrew` / `syncStages` / `syncLocation` — bulk re-sync from GHL API
- `provisionFields` — creates the 7 required GHL opportunity custom fields if missing
- `getCrewLocations` — returns latest GPS ping per driver per active job

### Logging

`logger.js` exports a Winston logger (colorized dev format, JSON prod format) and a `logActivity()` helper. `logActivity()` writes to `mh_pwa_activity_log` as fire-and-forget — it must never be awaited in a request handler.

---

## 6. GHL Integration

See [Integrations.md](Integrations.md) for the broader GHL context. This section focuses on the code paths.

### Token Lifecycle

Three-stage auth, implemented as axios response interceptor in `ghl.js`:

```
Stage 1 (normal): fetch OAuth token from n8n endpoint → cache 20 min
Stage 2 (401/403): invalidate cache, fetch fresh OAuth token → retry
Stage 3 (still 401/403): fetch PIT from n8n PIT endpoint → retry
  → if still failing: invalidate PIT cache, throw
```

**`ghlTokenService.js`** — `getToken(locationId)`: calls `N8N_TOKEN_ENDPOINT?location_id=X&app_id=Y`, expects `{ access_token }`. Caches in-memory for 20 minutes. `invalidateToken()` evicts the cache entry.

**`pitTokenService.js`** — `getPitToken(locationId)`: calls the n8n PIT endpoint, expects `{ pit }`. Caches indefinitely (PITs are long-lived). `invalidatePitToken()` evicts. Requires `GHL_PIT_NAME` env var.

All callers use `getGhlClient(locationId)` from `ghl.js` which returns an axios instance pre-configured with base URL, version header, and the interceptor. Never construct your own axios instance for GHL calls.

### Outbound Calls (`ghlOutbound.js`)

Every outbound function follows the same pattern:

1. Log intent
2. `getGhlClient(locationId)` to get an authenticated client
3. `retryWithBackoff(() => client.method(...))` for resilience
4. `logOutbound(eventType, payload, 'success'|'failed', locationId, errorMessage?)` to audit log

Available functions:

| Function | What it does |
|---|---|
| `pushStatusUpdate` | Updates GHL opportunity status |
| `pushCompletion` | Marks opportunity `won`, adds duration/completion note |
| `pushCancellation` | Marks opportunity `lost` with optional reason |
| `pushPhotoUrl` | Adds photo URL as a contact note |
| `pushStageUpdate` | Moves opportunity to a specific pipeline stage |
| `pushCustomFieldUpdate` | Updates a single custom field by field key (resolves UUID from DB) |
| `pushLocationUpdate` | Logs a location event (local only — no GHL opportunity notes API) |
| `provisionCustomFields` | Creates 7 required custom fields if missing; idempotent |

All outbound calls from `jobsController.js` are **fire-and-forget** — they are not awaited and failures are caught/logged but never block the response.

### Inbound Webhooks (`ghlHandler.js`)

Entry point: `POST /api/webhooks/ghl` (raw body, verified with Ed25519 signature).

Processing:
1. Verify `X-GHL-Signature` header using the public key from `GHL_WEBHOOK_PUBLIC_KEY`
2. Check tenant gate — all events except `INSTALL`/`AppInstall` must come from a known active tenant
3. Create sync log entry (`mh_pwa_ghl_sync_log`, status `pending`)
4. Dispatch to per-event handler via `switch(eventType)`
5. Always return `200` to prevent GHL retries for non-transient bugs

Event handlers:

| Event | Handler | Effect |
|---|---|---|
| `INSTALL` / `AppInstall` | `handleInstall` | Upserts tenant; bootstraps crew, custom fields, pipeline stages; retries after 45s if tokens not ready |
| `UNINSTALL` / `AppUninstall` | `handleUninstall` | Sets `is_active = false`; preserves data |
| `PLAN_CHANGE` | `handlePlanChange` | Updates `plan_id` |
| `LocationUpdate` | `handleLocationUpdate` | Syncs company name; note: uses `body.id` not `body.locationId` |
| `OpportunityCreate` / `OpportunityUpdate` / `OpportunityStageUpdate` | `handleOpportunityUpsert` | Fetches full opportunity from GHL API (webhooks have no custom fields), resolves field UUIDs, upserts to `mh_pwa_jobs` |
| `OpportunityStatusUpdate` | `handleOpportunityStatusUpdate` | Maps `won → completed`, `lost → cancelled` |
| `OpportunityAssignedToUpdate` | `handleAssignedToUpdate` | Updates `mh_pwa_job_crew_assignments`; fires push notification to assigned crew member |
| `OpportunityDelete` | `handleOpportunityDelete` | Sets status to `cancelled` |
| `UserCreate` / `UserUpdate` | `handleUserUpsert` | Upserts crew user; handles phone conflict by patching by phone |
| `UserDelete` | `handleUserDelete` | Soft-disables user (`is_active = false`) |

**Custom field resolution**: GHL webhooks for opportunities do not include custom field keys, only UUIDs. The handler calls the GHL API to get the full opportunity, then looks up UUID → key from `mh_pwa_location_custom_fields` (cached; refreshed daily). The resolved keys are needed by `buildJobPayload()` to extract pickup/dropoff address, scheduled date, etc.

**Stage → status mapping**: `stageStatusMap.js` maps GHL stage names (case-insensitive) to `job_status` enum values. This is the single source of truth used by both `ghlHandler.js` and `adminController.js`.

---

## 7. Frontend Architecture

### Stack

React + Vite, deployed as a PWA. No SSR. The app is a single-page application with client-side routing.

### Routing (`App.jsx`)

Two route guards:
- **`ProtectedRoute`** — redirects to `/` if `isAuthenticated` is false
- **`AdminRoute`** — additionally checks `user.role === 'admin'`

Route map:

| Path | Component | Guard |
|---|---|---|
| `/` | `LoginPage` | Public |
| `/dashboard` | `DashboardPage` | Auth |
| `/jobs/:id` | `JobDetailPage` | Auth |
| `/jobs/:id/create-invoice` | `CreateInvoicePage` | Auth |
| `/profile` | `ProfilePage` | Auth |
| `/admin` | `AdminDashboardPage` | Admin |
| `/admin/pipeline` | `PipelineSetupPage` | Admin |
| `/admin/stages` | `StageMappingPage` | Admin |
| `/admin/crew` | `CrewManagementPage` | Admin |
| `/admin/jobs` | `AdminJobsPage` | Admin |
| `/admin/invoice-settings` | `AdminInvoiceSettingsPage` | Admin |
| `/admin/notification-settings` | `AdminNotificationSettingsPage` | Admin |
| `/admin/crew-map` | `CrewMapPage` | Admin |
| `/admin/billing-rules` | `AdminBillingRulesPage` | Admin |

### API Service Layers

**`services/api.js`** — crew-facing axios instance. Base URL from `VITE_API_URL`. Request interceptor attaches JWT from `localStorage['mh_token']`. Response interceptor clears auth and redirects to `/` on 401. Exports typed helpers: `authApi`, `jobsApi`, `photosApi`, `locationsApi`, `invoicesApi`, `timesheetApi`.

**`services/adminApi.js`** — admin-only calls. Uses the same axios instance from `api.js`. No separate auth handling — inherits the same interceptors. Functions are named exports (not grouped in an object).

### State Management

**`store/authStore.js`** — single Zustand store, persisted to `localStorage` under key `mh-auth`. Shape:

```js
{
  user,            // crew_users row (minus pin_hash)
  token,           // JWT string
  timezone,        // IANA timezone string
  isAuthenticated, // boolean
  setAuth(user, token, timezone),
  logout()
}
```

`setAuth()` also writes `mh_token` to localStorage directly so the axios interceptor can read it without going through Zustand (avoids circular imports).

On rehydration, the store re-syncs `mh_token` to localStorage and calls `setTimezone()` to restore the timezone formatter.

### PWA Update Banner

`UpdateBanner.jsx` renders when a new service worker version has taken control. The service worker (`public/sw-custom.js`) posts a message to clients when it activates. The banner prompts the user to reload. This ensures crew members always run the latest version after a deploy.

### Offline Sync Queue

`src/utils/offlineQueue.js` provides a write-ahead queue stored in `localStorage`. When a mutation fails due to network unavailability, the action is pushed onto the queue. `src/hooks/useSyncQueue.js` listens for the browser `online` event and replays queued actions in order. The hook is mounted globally in `App.jsx` so it runs on every route — queued items are retried as soon as connectivity returns, regardless of which page the user is on.

Queue entries are plain objects with an `action` type and a `payload`. If a replayed action fails again (e.g. the server returns a 4xx), it is dropped from the queue — it is not retried indefinitely.

---

## 8. Push Notifications

### Setup

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `.env`. If these are not set, push is silently disabled (a warning is logged at startup).

### How It Works

1. Frontend calls `GET /notifications/vapid-key` to get the public key
2. Browser subscribes via `pushManager.subscribe()`
3. Frontend posts the subscription object to `POST /notifications/subscribe`
4. Backend stores `{ endpoint, p256dh, auth }` in `mh_pwa_push_subscriptions`

Backend sends notifications via `pushService.js`:
- `notifyUser(userId, payload)` — sends to all subscriptions for a specific user
- `notifyAdmins(locationId, payload)` — sends to all active admin users for a tenant

Expired/gone subscriptions (HTTP 410/404 from the push service) are deleted automatically.

### Fire-and-Forget Rule

**Push notification calls must never block a request.** All notification sends are wrapped in an IIFE with its own try/catch:

```js
// Correct pattern — never awaited
(async () => {
  try {
    await notifyAdmins(locationId, { ... });
  } catch (err) {
    logger.error(`Push failed: ${err.message}`);
  }
})();
```

If a notification fails, the request has already returned a response to the client. This is intentional.

---

## 9. Key Business Logic

### Invoice Create + Auto-Send Flow

When a crew member creates an invoice (`POST /jobs/:jobId/invoices`):

1. Verify crew assignment to the job
2. Fetch GHL contact, generate invoice number, load tenant settings — all in parallel
3. Build invoice payload with contact details, business details from tenant, tax from `invoice_taxes_enabled/tax_name/tax_rate`
4. `POST /invoices/` to GHL with `altId=locationId, altType=location`
5. Immediately `POST /invoices/:id/send` (action: `sms_and_email`) — crew never needs to manually send
6. Log both events to `mh_pwa_ghl_sync_log`
7. Fire push notification to admins (fire-and-forget)

If auto-send fails, the invoice is still created and the failure is logged. The crew member can retry sending from the UI.

### Convert Estimate to Invoice

`POST /jobs/:jobId/invoices/from-estimate`:

1. First `PUT /invoices/estimate/:id` with `estimateStatus: 'accepted'` — GHL requires this before conversion
2. Then `POST /invoices/estimate/:id/invoice` with `{ altId, altType, markAsInvoiced: true, version: 'v2' }` and `Version: 2023-02-21` header
3. Auto-send the resulting invoice

### Billing Rules

Stored in `mh_pwa_tenants`:
- `billing_rules_enabled` — toggle
- `billing_callout_minutes` — how many minutes count as a callout charge
- `invoice_partial_payment_enabled` — allow recording partial payments

These fields are read by `GET /admin/billing-rules` which is accessible to all authenticated users (crew needs them on `CreateInvoicePage`).

### Job Type

`mh_pwa_jobs.job_type` stores `door_to_door | depot_to_depot | quote`. The value is mapped from a GHL dropdown custom field (`Job Type`) whose raw label is mapped to the enum in `buildJobPayload()` in `ghlHandler.js`.

### Stage → Status Mapping

When a GHL webhook fires for an opportunity update, `stageStatusMap.js` maps the stage name to a `job_status` enum value. Mappings are case-insensitive. If no mapping exists, status is not changed (preserves any crew-set status). Admins can also configure custom mappings per stage via `POST /admin/stages`.

### Custom Field Cache

GHL returns custom fields on opportunities as `[{ id: UUID, fieldValue }]` — no field key. `ghlHandler.js` maintains a DB-backed cache in `mh_pwa_location_custom_fields` (UUID → key). The cache is refreshed when stale (older than 1 day) or empty. Admins can force-clear it via `POST /admin/refresh-fields`.

### Multi-Tenant Scoping

Every database query in a controller reads `locationId` from `req.user.locationId` (embedded in the JWT). This value is set at login from `mh_pwa_crew_users.location_id`. A user can only ever see data for their own tenant. There is no cross-tenant admin view.

---

## 10. Extension Points

### Adding a New API Route

1. Add the handler function to the appropriate controller (or create a new one)
2. Register the route in the matching router file (`routes/jobs.js`, `routes/admin.js`, etc.)
3. Add the appropriate middleware: `requireAuth` for crew routes, `requireAuth` + `requireAdmin` for admin-only
4. Add the corresponding API call to `frontend/src/services/api.js` or `adminApi.js`

Example (new admin-only route):
```js
// routes/admin.js
router.get('/new-thing', requireAuth, requireAdmin, myNewHandler);

// adminController.js
async function myNewHandler(req, res) {
  const locationId = req.user.locationId;
  // ...
}

// frontend/src/services/adminApi.js
export async function getNewThing() {
  const res = await api.get('/admin/new-thing');
  return res.data;
}
```

### Adding a New Migration

1. Name it `021_description.sql` (next sequential number)
2. Write idempotent SQL (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
3. Apply manually: `psql $DATABASE_URL < backend/supabase/migrations/021_description.sql`
4. Update `CLAUDE.md` to reflect the next migration number (`022_*`)

### Adding a New GHL Outbound Call

Add a new function to `ghlOutbound.js` following the existing pattern:

```js
async function pushMyThing(ghlJobId, data, locationId) {
  const eventType = 'opportunity.my_thing';
  const payload   = { ghlJobId, ...data, locationId };
  try {
    const client = await getGhlClient(locationId);
    await retryWithBackoff(() => client.put(`/opportunities/${ghlJobId}`, { ... }));
    await logOutbound(eventType, payload, 'success', locationId);
  } catch (err) {
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}
```

Call it fire-and-forget from the controller — never await it inside a request handler.

### Adding a New Admin Page

1. Create `frontend/src/pages/admin/MyNewPage.jsx`
2. Import it in `App.jsx`
3. Add an `AdminRoute`-wrapped `<Route path="/admin/my-page" element={<AdminRoute><MyNewPage /></AdminRoute>} />`
4. Add navigation link to `AdminDashboardPage.jsx`
5. Call admin API functions from `adminApi.js`

---

## 11. Common Gotchas and Design Decisions

### GHL Invoice API Uses `altId`/`altType`, Not `locationId`

All GHL invoice and estimate API calls require:
```js
{ altId: locationId, altType: 'location' }
```
Using `locationId` directly in the body will fail silently or return an error.

### Invoice Amounts Are in Dollars, Not Cents

Despite some GHL documentation implying cents, the actual API accepts dollar amounts. `amount: 100` means $100.00, not $1.00.

### Estimates Require a Different Version Header

All estimate endpoints require:
```js
headers: { Version: '2023-02-21' }
```
This is different from the global default (`2021-07-28`). Omitting it returns a 404 or incorrect response.

### Push Notifications Must Never Block a Request

Every `notifyUser` or `notifyAdmins` call must be inside a fire-and-forget IIFE with its own error handling. The client must receive a response before any push attempt completes or fails.

### Crew-Accessible Admin Endpoints

These two admin endpoints use `requireAuth` only (no `requireAdmin`):
- `GET /admin/invoice-settings` — crew needs tax settings when building invoices
- `GET /admin/billing-rules` — crew needs callout minutes for invoice calculation

Any new admin endpoint that crew needs to read should follow the same pattern. Write endpoints remain admin-only.

### `requireAdmin` Lives in `adminController.js`

The `requireAdmin` middleware is exported from `adminController.js` (not from `middleware/`). This is intentional — it's a thin role check used only in the admin router.

### `LocationUpdate` Webhook Uses `body.id`, Not `body.locationId`

This is a GHL inconsistency. The `handleLocationUpdate` handler explicitly reads `body.id` as the location identifier. All other event handlers use `body.locationId`.

### Token Caching Is Per-Process

Both `ghlTokenService.js` and `pitTokenService.js` use in-memory `Map` caches. In a multi-process or multi-instance deployment, each process has its own cache. This is acceptable because the n8n token endpoint is fast and the retry logic handles token staleness gracefully.

### Custom Fields Are UUID-Keyed on GHL Opportunity Fetch

When you call `GET /opportunities/:id`, GHL returns:
```json
"customFields": [{ "id": "some-uuid", "fieldValue": "value" }]
```
There is no field key — only the UUID. The `getFieldKeyMap()` function in `ghlHandler.js` resolves these UUIDs to human-readable keys using the `mh_pwa_location_custom_fields` cache. If a field UUID is missing from the cache, `extractCustomField()` returns `null` for that field. This is why `provisionCustomFields` and the field cache are critical to correct job data.

### Jobs Are Never Hard-Deleted

`OpportunityDelete` webhooks set status to `cancelled`, not delete the row. Soft-deletion preserves job history, timesheets, photos, and assignments.

### GHL INSTALL Fires Before OAuth Tokens Are Ready

The bootstrap tasks inside `handleInstall` (sync crew, provision fields, fetch pipelines) may fail because GHL issues the INSTALL webhook before OAuth tokens are available. The handler runs bootstrap immediately, counts failures, then retries after 45 seconds if any failed. Timezone and invoice settings are also retried on the 45-second delay.
