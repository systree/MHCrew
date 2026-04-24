# Mover Hero Crew App — Deployment Guide

## Domains

- Frontend : https://mhcrew.413157239.xyz
- Backend : https://api-mhcrew.413157239.xyz

---

## Before First Deployment

### 1. Run database migration

In Supabase dashboard → SQL Editor, run:
`backend/supabase/migrations/013_activity_log.sql`

---

## Deploy Frontend

1. Create `frontend/.env.production`:

   ```
   VITE_API_URL=https://api-mhcrew.413157239.xyz/api
   ```

2. Build:

   ```bash
   cd frontend
   npm run build
   ```

3. Upload contents of `frontend/dist/` to the frontend subdomain's document root via cPanel File Manager.

4. Create `.htaccess` in the same folder (for SPA routing):
   ```
   Options -MultiViews
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^ index.html [QSA,L]
   ```

---

## Deploy Backend

1. Upload all files from the `backend/` folder to the server via cPanel File Manager.
   - **Exclude:** `node_modules/`, `.env`, `logs/`

2. Create the `.env` file on the server with these values:

   ```
   NODE_ENV=production
   PORT=3001

   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-supabase-service-role-key

   GHL_API_BASE_URL=https://services.leadconnectorhq.com
   GHL_APP_ID=69d499cf5c08203922f958f9
   N8N_TOKEN_ENDPOINT=https://n8n.app.systree.com.au/webhook/get-token

   GHL_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nYOUR_KEY_HERE\n-----END PUBLIC KEY-----"

   JWT_SECRET=a-long-random-secret-minimum-32-characters

   MOBILEMESSAGE_API_KEY=your-mobilemessage-api-key
   MOBILEMESSAGE_SENDER_ID=MoverHero

   OTP_BYPASS_PHONES=

   ADMIN_KEY=mhcrew-admin-2026
   ```

3. In cPanel → Setup Node.js App, create a new app:
   - **Node.js version:** 18+
   - **Application mode:** Production
   - **Application root:** /home/xyz12349/api-mhcrew.413157239.xyz
   - **Application URL:** api-mhcrew.413157239.xyz
   - **Application startup file:** index.js

4. Click **Run NPM Install**, then **Start App**.

---

## Redeploying After Changes

**Frontend:** Rebuild locally → upload new `dist/` contents → done.

**Backend:** Upload changed files (skip `node_modules`) → in cPanel Node.js App, click **Restart App**. If `package.json` changed, click **Run NPM Install** first.

---

## Post-Deployment Checks

- `https://api-mhcrew.413157239.xyz/health` returns `{"status":"ok"}`
- Login page loads at `https://mhcrew.413157239.xyz`
- OTP SMS arrives and login completes
- Jobs load on dashboard
- Status updates push to GHL
- PWA installs on mobile

---

## Notes

- `GHL_WEBHOOK_PUBLIC_KEY` must be a single line with `\n` replacing actual newlines.
- `JWT_SECRET` change invalidates all active sessions (crew gets logged out).
- `OTP_BYPASS_PHONES` must be empty in production.
- Supabase Storage bucket `job-photos` must exist and be set to **public**.
- Update GHL webhook URL in GHL Marketplace → Your App → Webhooks to: `https://api-mhcrew.413157239.xyz/api/webhooks/ghl`
