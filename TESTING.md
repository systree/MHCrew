# Mover Hero Crew App — Testing Setup Guide

## Prerequisites

- Node.js >= 18
- A Supabase project (free tier is fine)
- A GoHighLevel account with API access
- SMS-capable phone number for OTP testing

---

## Step 1 — Supabase Setup

### 1a. Run Migrations

In your Supabase project → SQL Editor, run these files **in order**:

1. `backend/supabase/migrations/001_enums.sql`
2. `backend/supabase/migrations/002_tables.sql`
3. `backend/supabase/migrations/003_indexes.sql`
4. `backend/supabase/migrations/004_rls.sql`
5. `backend/supabase/migrations/005_functions.sql`

### 1b. Create Storage Bucket

1. Go to Supabase → Storage
2. Click "New bucket"
3. Name: `job-photos`
4. Set to **Public**
5. Click Create

### 1c. Enable Phone Auth

1. Go to Supabase → Authentication → Providers
2. Enable **Phone** provider
3. Configure your SMS provider (Twilio recommended) or use Supabase's built-in test OTPs

### 1d. Get your keys

From Supabase → Settings → API:
- `SUPABASE_URL` → Project URL
- `SUPABASE_SERVICE_KEY` → `service_role` key (not the anon key)

---

## Step 2 — Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env`:

```env
PORT=3001
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_KEY=your-ghl-private-integration-key
GHL_WEBHOOK_SECRET=any-random-string-you-choose
GHL_CREW_TAG_PREFIX=crew:
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
```

Start backend:
```bash
npm run dev
# Should print: Server running on port 3001
```

Test health check:
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## Step 3 — Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.development`:
```env
VITE_API_URL=http://localhost:3001/api
```

Start frontend:
```bash
npm run dev
# Opens at http://localhost:5173
```

---

## Step 4 — GHL Webhook Setup (optional for basic testing)

To test inbound webhooks from GHL:

1. Deploy backend to a public URL (e.g. Railway, Render, or use ngrok for local)
2. In GHL → Settings → Webhooks → Add webhook
3. URL: `https://your-domain.com/api/webhooks/ghl`
4. Events: Opportunity Create, Opportunity Update, Opportunity Delete, Contact Tag Update
5. Set the secret to match your `GHL_WEBHOOK_SECRET` env var

For local testing with ngrok:
```bash
ngrok http 3001
# Use the https URL ngrok gives you
```

---

## Step 5 — Manual Test Checklist

### Auth Flow
- [ ] Enter phone number → OTP received via SMS
- [ ] Enter OTP → redirected to PIN setup
- [ ] Set 4-digit PIN → redirected to dashboard
- [ ] Log out → enter phone + PIN → back to dashboard
- [ ] "Use OTP instead" fallback works

### Job Dashboard
- [ ] Dashboard shows "No jobs assigned" if none exist
- [ ] After creating a job in GHL and assigning crew → job appears on dashboard
- [ ] Jobs grouped by Today / Tomorrow / date

### Job Detail & Status
- [ ] Tap a job → job detail loads
- [ ] "Start Driving" → status updates to enroute
- [ ] "I've Arrived" → status updates to arrived
- [ ] "Start Job" → status updates to in_progress
- [ ] "Complete Job" → notes modal → status updates to completed
- [ ] "Cancel Job" → reason required → status updates to cancelled
- [ ] GHL opportunity status updates after each change

### Time Tracking
- [ ] Clock In button appears on arrived/in_progress jobs
- [ ] Live timer counts up in HH:MM:SS
- [ ] Start Break → break timer counts up
- [ ] End Break → break minutes accumulate
- [ ] Clock Out → summary shows total time and break time
- [ ] Refresh page mid-shift → timer resumes from correct time

### Photos
- [ ] "Take Photo" opens camera (mobile) or file picker (desktop)
- [ ] Select photo type (before/after/damage/item/other)
- [ ] Upload progress bar shows 0–100%
- [ ] Photo appears in grid after upload
- [ ] Tap photo → fullscreen lightbox
- [ ] Delete photo → confirm dialog → removed from grid
- [ ] Photo URL appears as note in GHL contact

### GPS (mobile only)
- [ ] Permission prompt appears on first active job
- [ ] Location captured when status changes to enroute/arrived
- [ ] Denied permission → yellow notice banner (non-blocking)
- [ ] GHL opportunity gets location note on enroute/arrived

### Offline
- [ ] Turn off WiFi/data → offline banner appears
- [ ] Update job status offline → "Saved offline" feedback
- [ ] Reconnect → banner shows "Syncing..." → "All caught up"
- [ ] Status update synced to server after reconnect
- [ ] Photo upload shows error (not queued) when offline

---

## Step 6 — Seed Test Data (manual)

Until GHL webhook is wired up, you can insert test data directly in Supabase:

### Insert a test crew user
```sql
INSERT INTO mh_pwa_crew_users (phone, full_name, role)
VALUES ('+61412345678', 'Test Crew', 'crew');
```

### Insert a test job
```sql
INSERT INTO mh_pwa_jobs (ghl_job_id, customer_name, pickup_address, dropoff_address, scheduled_date, status)
VALUES ('test-job-001', 'John Smith', '123 Main St, Sydney', '456 Park Rd, Melbourne', now() + interval '2 hours', 'assigned');
```

### Assign crew to job
```sql
INSERT INTO mh_pwa_job_crew_assignments (job_id, crew_user_id)
SELECT j.id, c.id
FROM mh_pwa_jobs j, mh_pwa_crew_users c
WHERE j.ghl_job_id = 'test-job-001'
  AND c.phone = '+61412345678';
```

---

## Common Issues

| Issue | Fix |
|---|---|
| OTP not received | Check Supabase Phone provider is enabled + SMS provider configured |
| `SUPABASE_SERVICE_KEY` error | Use `service_role` key, NOT the `anon` key |
| Photos not uploading | Ensure `job-photos` bucket exists and is set to **public** |
| JWT errors | Regenerate `JWT_SECRET` with the crypto command above |
| GHL webhook 401 | Ensure `GHL_WEBHOOK_SECRET` matches what's configured in GHL |
| Table not found | Ensure all 5 migration files were run in order in Supabase SQL editor |

---

## Architecture Reminder

```
GHL ──webhook──→ POST /api/webhooks/ghl ──→ mh_pwa_jobs (upsert)
                                        ──→ mh_pwa_job_crew_assignments

PWA ──────────→ GET /api/jobs          ──→ returns assigned jobs
     ──────────→ PATCH /jobs/:id/status ──→ updates DB + pushes to GHL
     ──────────→ POST /jobs/:id/photos  ──→ Supabase Storage + GHL note
     ──────────→ POST /jobs/:id/locations ─→ mh_pwa_job_locations + GHL note
```
