# Rod's Billing Features — what's special and how to test

> Plain-language guide to the tenant-specific invoicing behaviour built for Rod
> (Mover Hero). Source of truth for *what he asked for* is `Rod.txt` (his replies)
> and `rod-validation.txt` (the questionnaire); design/status is in
> `BILLING_ROADMAP.md`. Last updated 2026-06-24.

## Why these only apply to Rod

They're **per-tenant feature flags** on `mh_pwa_tenants`, all defaulting **OFF**.
They are switched **ON only for Rod's location**, so every other tenant keeps the
plain invoice flow. Controlled from **two admin pages**:

- **Admin → Billing Rules** (`frontend/.../admin/AdminBillingRulesPage.jsx`)
- **Admin → Invoice Settings** (`frontend/.../admin/AdminInvoiceSettingsPage.jsx`)

Backend flags (migrations 015 / 019 / 020 / 025):

| Flag (DB column) | Meaning |
|---|---|
| `billing_rules_enabled` | Master switch for job-type billing helpers |
| `billing_callout_minutes` (default 30) | Door-to-Door callout charge length |
| `billing_minimum_charge_enabled` / `_amount` | Floor the Moving Service line (e.g. $660) |
| `invoice_partial_payment_enabled` | Show the 1/3–1/3–1/3 split option |
| `invoice_show_estimates` | Show estimates / convert-to-invoice on the job |

## The linchpin: Job Type

Most billing logic only fires when the job has a **`job_type`**, set via the GHL
opportunity **"Job Type"** dropdown (*Door to Door / Depot to Depot / Quote*) and
synced into `mh_pwa_jobs.job_type`. No job type → no helpers, just a manual invoice.

## Features, toggles, and how to test each

The crew flow is: open a job → **Create Invoice** (`CreateInvoicePage`). The billing
maths lives there (`getBillingRules()` + job type drive the line items).

### 1. Job-type billing helpers — `Enable Billing Rules`
- Turn ON. Open a **Door to Door** or **Depot to Depot** job → Create Invoice.
- Expect **Work Hours + Hourly Rate** inputs that auto-build the line items.
- Turn OFF → inputs gone, invoice is fully manual (default behaviour).

### 2. Door-to-Door callout — `Door-to-Door Callout (minutes)` = 30
- Door-to-Door job, billing ON, enter e.g. **2 h @ $220**.
- Expect: `Moving Service (2h) $440` **+** `Callout Charge (30 min) $110`.

### 3. Depot-to-Depot — (same Enable Billing Rules)
- Depot-to-Depot job → enter hours/rate.
- Expect: **only** `Moving Service (Xh)` — **no** callout line.

### 4. Minimum charge — `Minimum Charge` + amount (e.g. 660)
- ON, amount 660. Door/Depot job, enter a small total (**1 h @ $220 = $220**).
- Expect the line floored to **$660**, labelled `Moving Service (minimum charge)`.
- Enter a total > $660 → not floored (normal label/amount).

### 5. 1/3–1/3–1/3 partial payment — `Partial Payments (Interstate)`
- ON. Any job → Create Invoice → a **"Split into 3 payments"** checkbox appears.
- The date picker relabels to **"First payment date"**. Pick a date (or leave empty
  = today).
- Tick + send → the GHL invoice gets a 33/33/34 schedule on **d, d+1, d+2**, with the
  invoice **due d+3** (GHL requires schedule dates strictly before the due date).
- Verify the 3 scheduled payments in GHL. OFF → checkbox hidden.

### 6. Quote / estimates — `Show Estimates` (Invoice Settings)
- ON. Open a job that has a GHL **estimate** → the **Estimates** section appears on
  the job detail with **Convert to Invoice** (this is how a Quote's fixed price flows
  in; otherwise add a manual fixed-price line).
- OFF → estimates section hidden.

### 7. Mark paid + crew confirms — *(no toggle, always on)*
- On a job with an invoice, record payment / mark paid on the job detail; confirm it
  shows **paid** in GHL. Rod takes all payment on the day and does **not** distinguish
  cash / card / EFTPOS.

### 8. Cash jobs — *(nothing special by design)*
- Rod just lists / cancels / deletes jobs; no separate cash handling.

## Parked (NOT built)

**Crew "pay time" breakdown** — Rod wanted crew paid *depot-to-depot* (worked time +
travel), editable worked-vs-total time, and a `Job time 2h → Pay time 2h 30m` display.
That's a **payroll** concern, deliberately deferred. See `BILLING_ROADMAP.md §1`.
