# Mover Hero Crew App — Build Plan

## Status: Phase 1–3 Complete. Ready for Testing.

---

## Tech Stack

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Frontend    | React 18 + Vite 5 (PWA)                 |
| Backend     | Node.js + Express (CommonJS)            |
| Database    | Supabase (Postgres + Auth + Storage)    |
| CRM         | GoHighLevel (source of truth for jobs)  |
| Auth        | Phone OTP (Supabase SMS) + 4-digit PIN  |

---

## Project Structure

```
mhcrewapp/
├── PLAN.md                        ← this file
├── TESTING.md                     ← setup + test guide
├── idea.txt                       ← original spec reference
│
├── backend/                       ← Node.js + Express API
│   ├── index.js                   ← entry point, PORT 3001
│   ├── .env.example               ← all required env vars
│   ├── package.json
│   ├── src/
│   │   ├── routes/
│   │   │   ├── index.js           ← mounts all routers under /api
│   │   │   ├── auth.js            ← /auth/*
│   │   │   ├── jobs.js            ← /jobs, /jobs/:id, /jobs/:id/status
│   │   │   ├── timesheets.js      ← /jobs/:jobId/timesheets/*
│   │   │   ├── photos.js          ← /jobs/:jobId/photos/*
│   │   │   ├── locations.js       ← /jobs/:jobId/locations
│   │   │   └── webhooks.js        ← /webhooks/ghl
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── jobsController.js
│   │   │   ├── timesheetController.js
│   │   │   ├── photosController.js
│   │   │   └── locationsController.js
│   │   ├── services/
│   │   │   ├── supabase.js        ← Supabase client (service role)
│   │   │   ├── ghl.js             ← GHL axios client
│   │   │   └── ghlOutbound.js     ← push status/photos/locations to GHL
│   │   ├── webhooks/
│   │   │   └── ghlHandler.js      ← inbound GHL webhook processor
│   │   ├── middleware/
│   │   │   ├── auth.js            ← JWT verify → req.user = { userId, phone, role }
│   │   │   ├── errorHandler.js
│   │   │   └── validate.js        ← Zod middleware factory
│   │   └── utils/
│   │       ├── logger.js          ← Winston
│   │       └── retry.js           ← retryWithBackoff(fn, maxAttempts, baseDelayMs)
│   └── supabase/
│       └── migrations/
│           ├── 001_enums.sql
│           ├── 002_tables.sql
│           ├── 003_indexes.sql
│           ├── 004_rls.sql
│           └── 005_functions.sql
│
└── frontend/                      ← React + Vite PWA
    ├── index.html
    ├── vite.config.js             ← VitePWA, NetworkFirst for /api/jobs
    ├── package.json
    ├── public/
    │   ├── manifest.json          ← PWA manifest (dark theme)
    │   └── icons/README.md        ← needs icon-192.png + icon-512.png
    └── src/
        ├── main.jsx
        ├── App.jsx                ← Router, ProtectedRoute, useSyncQueue at root
        ├── index.css              ← dark theme, CSS variables, mobile-first
        ├── pages/
        │   ├── LoginPage.jsx      ← phone → OTP → PIN (setup or entry)
        │   ├── DashboardPage.jsx  ← grouped jobs (Today / Tomorrow / date)
        │   ├── JobDetailPage.jsx  ← status actions, TimeTracker, PhotoCapture
        │   └── ProfilePage.jsx
        ├── components/
        │   ├── JobCard.jsx
        │   ├── StatusBadge.jsx    ← colour-coded pill for all 6 statuses
        │   ├── BottomNav.jsx
        │   ├── OfflineBanner.jsx  ← queue count + sync state
        │   ├── TimeTracker.jsx    ← clock in/out, breaks, live HH:MM:SS timer
        │   └── PhotoCapture.jsx   ← camera/gallery, type selector, grid, lightbox
        ├── hooks/
        │   ├── useAuth.js
        │   ├── useJobs.js         ← stale-while-revalidate, offline enqueue
        │   ├── useGPS.js          ← event-based location capture
        │   └── useOnlineStatus.js
        ├── services/
        │   └── api.js             ← axios + authApi, jobsApi, timesheetApi, photosApi, locationsApi
        ├── store/
        │   └── authStore.js       ← Zustand + localStorage persist
        └── utils/
            ├── formatters.js
            └── offlineQueue.js    ← localStorage action queue (STATUS_UPDATE, LOCATION_LOG)
        (hooks also includes useSyncQueue.js)

```

---

## Database Tables (all prefixed `mh_pwa_`)

| Table | Purpose |
|---|---|
| `mh_pwa_crew_users` | Crew member accounts (phone, pin_hash, role, ghl_contact_id) |
| `mh_pwa_jobs` | Jobs synced from GHL (status, addresses, scheduled_date, raw payload) |
| `mh_pwa_job_crew_assignments` | Many-to-many: which crew are assigned to which job |
| `mh_pwa_timesheets` | Clock-in/out records, break_minutes, computed total_minutes |
| `mh_pwa_job_photos` | Photo metadata (storage_path, public_url, photo_type, ghl_synced) |
| `mh_pwa_job_locations` | GPS pings (lat/lng, trigger_event, synced_to_ghl) |
| `mh_pwa_ghl_sync_log` | Audit log for all inbound + outbound GHL syncs |

---

## API Routes

All routes are prefixed `/api`

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/send-otp` | Send SMS OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP, returns JWT + requiresPinSetup |
| POST | `/api/auth/setup-pin` | Set 4-digit PIN (protected) |
| POST | `/api/auth/login-pin` | Login with phone + PIN |
| GET  | `/api/auth/me` | Get current user (protected) |

### Jobs
| Method | Route | Description |
|---|---|---|
| GET   | `/api/jobs` | Get all assigned jobs (today + upcoming) |
| GET   | `/api/jobs/:id` | Get single job |
| PATCH | `/api/jobs/:id/status` | Update status (validates transitions) |

### Timesheets
| Method | Route | Description |
|---|---|---|
| POST | `/api/jobs/:jobId/timesheets/clock-in` | Clock in |
| POST | `/api/jobs/:jobId/timesheets/clock-out` | Clock out (accepts breakMinutes) |
| POST | `/api/jobs/:jobId/timesheets/break-end` | Add break minutes |
| GET  | `/api/jobs/:jobId/timesheets` | Get timesheets for job |

### Photos
| Method | Route | Description |
|---|---|---|
| POST   | `/api/jobs/:jobId/photos` | Upload photo (multipart, max 10MB) |
| GET    | `/api/jobs/:jobId/photos` | List photos for job |
| DELETE | `/api/jobs/:jobId/photos/:photoId` | Delete own photo |

### Locations
| Method | Route | Description |
|---|---|---|
| POST | `/api/jobs/:jobId/locations` | Log GPS location |
| GET  | `/api/jobs/:jobId/locations` | Get last 50 locations |

### Webhooks
| Method | Route | Description |
|---|---|---|
| POST | `/api/webhooks/ghl` | Inbound GHL webhook (HMAC-SHA256 verified) |

### Health
| Method | Route | Description |
|---|---|---|
| GET | `/health` | `{ status: 'ok', timestamp }` |

---

## Job Status Flow

```
assigned → enroute → arrived → in_progress → completed
                                           ↘ cancelled
(any status can transition to cancelled)
```

---

## GHL Integration

**Inbound (GHL → App)** via `POST /api/webhooks/ghl`:
- `OpportunityCreate` / `job.created` → upsert `mh_pwa_jobs`
- `OpportunityUpdate` / `job.updated` → upsert `mh_pwa_jobs`
- `OpportunityDelete` / `job.cancelled` → mark cancelled
- `ContactTagUpdate` with `crew:` prefix → assign to `mh_pwa_job_crew_assignments`

**Outbound (App → GHL)** fire-and-forget via `ghlOutbound.js`:
- Status change → `PUT /opportunities/:id`
- Completion → `PUT /opportunities/:id` (status: won)
- Cancellation → `PUT /opportunities/:id` (status: lost)
- Photo upload → `POST /contacts/:id/notes`
- GPS enroute/arrived → `POST /opportunities/:id/notes`

---

## GPS Strategy
- Event-based (battery efficient): captures on status change (enroute, arrived, in_transit)
- Interval: every 10 mins while job is active (pauses when tab backgrounded)
- Offline queue: `localStorage gps_queue_{jobId}`, flushed on reconnect
- Privacy: zero captures on completed/cancelled jobs

---

## Offline Queue
- localStorage key: `mh_offline_queue`
- Queued action types: `STATUS_UPDATE`, `LOCATION_LOG`
- Photos NOT queued (binary too large for localStorage)
- Flushed sequentially on `offline → online` transition
- Max 3 attempts per action, then dropped

---

## Environment Variables (backend/.env)

```
PORT=3001
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_KEY=
GHL_WEBHOOK_SECRET=
GHL_CREW_TAG_PREFIX=crew:
JWT_SECRET=
```

## Environment Variables (frontend/.env.development)

```
VITE_API_URL=http://localhost:3001/api
```

---

## Build Phases

- [x] **Phase 1 — Foundation**
  - [x] Backend scaffold (Express + middleware + utils)
  - [x] Frontend PWA scaffold (React + Vite + PWA manifest)
  - [x] Supabase migrations (5 SQL files)
  - [x] GHL webhook handler (inbound + outbound)
  - [x] Auth (Phone OTP + PIN)

- [x] **Phase 2 — Execution**
  - [x] Job status updates + GHL push
  - [x] Time tracking (clock in/out + breaks + live timer)
  - [x] Photo capture + upload (Supabase Storage)

- [x] **Phase 3 — Reliability**
  - [x] GPS tracking (event-based, battery-efficient)
  - [x] Offline sync queue + PWA service worker

- [x] **Phase 4 — Admin Section + Pipeline Stage Sync + Invoices**
  - [x] Migration 012: `pipeline_id` on tenants + `mh_pwa_pipeline_stages` table
  - [x] Admin API routes (pipelines, stages, crew, sync-jobs) — JWT auth, role=admin
  - [x] Install bootstrap: on INSTALL webhook, bulk-upsert crew users + custom fields + pipeline stages
  - [x] Outbound stage sync: status change moves GHL opportunity to mapped pipeline stage
  - [x] Outbound custom field: `opportunity.job_status` updated on every status change (human-readable labels)
  - [x] Frontend: AdminRoute guard, admin pages (PipelineSetup, StageMapping, CrewManagement, AdminDashboard)
  - [x] BottomNav: show Admin link for role=admin
  - [x] Invoice display: GET /jobs/:jobId/invoices fetches live from GHL, shown in JobDetailPage (collapsible, line items, status badges)
  - [x] All field name bugs fixed (snake_case vs camelCase, stage_id vs id, etc.)

- [ ] **Phase 5 — Future**
  - [ ] Inventory & condition reporting
  - [ ] Tap-to-Pay
  - [ ] Push notifications

---

## Known Decisions & Notes

- All Supabase table names use `mh_pwa_` prefix
- JWT payload shape: `{ userId, phone, role }` — access as `req.user.userId` in controllers
- Supabase Storage bucket `job-photos` must be created manually (set to public)
- GHL uses service role key — bypasses RLS entirely
- `total_minutes` on timesheets is a Postgres `GENERATED ALWAYS AS STORED` column — never write it from code
- Multer uses memory storage (no temp files) — buffer uploaded directly to Supabase
- HEIC/HEIF accepted from iPhones, stored as-is
