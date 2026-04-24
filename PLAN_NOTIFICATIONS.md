# PWA Push Notifications — Implementation Plan

## Overview
Tenant-scoped Web Push notifications using the VAPID protocol.
- Crew receives push when a job is assigned to them
- Admin receives push for crew actions (status change, invoice create/send/delete)
- Admin can toggle each notification type on/off per tenant
- All subscriptions and settings are scoped by `location_id`

---

## Notification Events

| Event | Recipient | Trigger point | Toggle key |
|-------|-----------|---------------|------------|
| Job assigned | Crew (assigned members) | GHL webhook → job assignment | `notif_crew_job_assigned` |
| Status changed | All admins | `PATCH /api/jobs/:id/status` | `notif_admin_status_changed` |
| Invoice created | All admins | `POST /api/jobs/:jobId/invoices` | `notif_admin_invoice_created` |
| Invoice sent | All admins | `POST /api/jobs/:jobId/invoices/:id/send` | `notif_admin_invoice_sent` |
| Invoice deleted | All admins | `DELETE /api/jobs/:jobId/invoices/:id` | `notif_admin_invoice_deleted` |

---

## Implementation Steps

### [ ] Step 1 — DB Migrations
- `016_push_subscriptions.sql` — `mh_pwa_push_subscriptions` table
- `017_notification_settings.sql` — Add 5 toggle columns to `mh_pwa_tenants`

### [ ] Step 2 — Backend: Push Service
- Install `web-push`
- Add VAPID env vars
- `src/services/pushService.js` — send to user, send to all admins

### [ ] Step 3 — Backend: Notification Routes & Controller
- `src/controllers/notificationController.js` — subscribe/unsubscribe/vapid-key
- `src/routes/notifications.js` — route definitions
- Admin routes: get/update notification settings

### [ ] Step 4 — Backend: Wire Triggers
- `jobsController.js` `updateStatus` → notify admins
- Invoice actions in `jobsController.js` → notify admins
- `ghlHandler.js` job assignment → notify crew members

### [ ] Step 5 — Frontend: Custom Service Worker
- Switch VitePWA to `injectManifest` strategy
- Write `src/sw-custom.js` with push + notificationclick handlers

### [ ] Step 6 — Frontend: Push Hook + API
- `src/hooks/usePushNotifications.js`
- Add notification endpoints to `src/services/api.js`

### [ ] Step 7 — Frontend: Profile Page Toggle
- Crew opt-in/out for push notifications

### [ ] Step 8 — Frontend: Admin Notification Settings Page
- New page + route + nav link
- Toggles for all 5 notification types

---

## File Inventory

**New files:**
- `backend/supabase/migrations/016_push_subscriptions.sql`
- `backend/supabase/migrations/017_notification_settings.sql`
- `backend/src/services/pushService.js`
- `backend/src/controllers/notificationController.js`
- `backend/src/routes/notifications.js`
- `frontend/src/sw-custom.js`
- `frontend/src/hooks/usePushNotifications.js`
- `frontend/src/pages/admin/AdminNotificationSettingsPage.jsx`

**Modified files:**
- `backend/src/routes/index.js` — mount notifications router
- `backend/src/controllers/adminController.js` — notification settings CRUD
- `backend/src/controllers/jobsController.js` — trigger notifications on status + invoice actions
- `backend/src/webhooks/ghlHandler.js` — trigger crew notification on job assignment
- `backend/.env.example` — add VAPID vars
- `frontend/vite.config.js` — switch to injectManifest strategy
- `frontend/src/services/api.js` — add notification API calls
- `frontend/src/pages/ProfilePage.jsx` — push toggle UI
- `frontend/src/App.jsx` — add admin/notification-settings route
- `frontend/src/pages/admin/AdminDashboardPage.jsx` — add nav link
