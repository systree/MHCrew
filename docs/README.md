# Mover Hero Crew App — Documentation

Mover Hero Crew App is a Progressive Web App (PWA) for removalist (moving) companies. It gives field crew members a mobile interface to manage their jobs in real time — viewing assignments, updating job status, tracking time, capturing photos, and creating invoices on-site.

The app is a GoHighLevel (GHL) Marketplace application. When a company installs it, the system automatically registers them as a tenant, imports their staff, and begins syncing job data from GHL. GHL remains the system of record; the app is the mobile layer on top of it.

There are two user roles: **crew** (movers in the field) and **admins** (managers who configure the app, manage the team, and oversee all jobs).

---

## Documentation Index

| Document | Description |
|---|---|
| [System Overview](System%20Overview.md) | What the app is, who uses it, the core concepts behind jobs, tenants, and the GHL relationship |
| [Architecture](Architecture.md) | Technical structure — backend routes, frontend layout, database schema, middleware, and hosting |
| [End-to-End Application Flow](End-to-End%20Application%20Flow.md) | Complete lifecycle — from GHL Marketplace install through every major user journey (auth, job updates, invoicing, notifications) |
| [Data Flow](Data%20Flow.md) | How each data type (tenants, jobs, invoices, photos, timesheets) enters, moves through, and leaves the system |
| [Integrations](Integrations.md) | Every external system the app connects to — GHL, Supabase Storage, n8n, Web Push — with payloads, error handling, and gotchas |
| [Developer Guide](Developer%20Guide.md) | Project setup, codebase structure, auth system, GHL integration details, key business logic, and common pitfalls for new developers |
| [User Manual](User%20Manual.md) | Non-technical guide for crew and admins — how to log in, work through jobs, track time, create invoices, and configure the system |

---

## Quick Start

### New developer

1. Read [System Overview](System%20Overview.md) to understand what the app does and why
2. Read [Architecture](Architecture.md) for the technical structure
3. Follow [Developer Guide](Developer%20Guide.md) to set up locally and understand key conventions
4. Refer to [Integrations](Integrations.md) before touching anything GHL-related

### Crew member or admin

Go straight to the [User Manual](User%20Manual.md). No technical knowledge required.

---

## Key Facts at a Glance

| | |
|---|---|
| **Backend** | Node.js (≥18) + Express 4 |
| **Frontend** | React + Vite, PWA (Workbox) |
| **Database** | Supabase (PostgreSQL) |
| **File storage** | Supabase Storage (job photos) |
| **CRM** | GoHighLevel (GHL) — system of record for jobs, contacts, invoices |
| **Auth** | Custom OTP via MobileMessage · JWT · optional PIN |
| **Token service** | n8n endpoint (`N8N_TOKEN_ENDPOINT`) issues GHL OAuth tokens with PIT fallback |
| **Hosting** | Railway (backend + frontend) |
| **Multi-tenant** | Every DB query scoped by `location_id` (one GHL sub-account = one tenant) |
| **DB table prefix** | `mh_pwa_` (e.g. `mh_pwa_jobs`, `mh_pwa_tenants`) |
| **Migrations** | `backend/supabase/migrations/` — applied in sequence (next: `021_*`) |
| **GHL base URL** | `https://services.leadconnectorhq.com` |
| **GHL API version** | `2021-07-28` (default) · `2023-02-21` (Estimates API only) |
| **Webhook security** | Ed25519 signature verified on every inbound GHL webhook |
