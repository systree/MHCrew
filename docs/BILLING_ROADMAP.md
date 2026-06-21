# Billing / Invoicing Roadmap

> Future-work items from Rod's invoicing requirements (see `Rod.txt` for his full
> replies). Captures what's parked and what needs a plan. **Not yet built.**

## Status of Rod's requirements (as of 2026-06-21)

| Requirement | Status |
|-------------|--------|
| 3 job types (Door to Door / Depot to Depot / Quote) | ✅ implemented (`job_type` enum, GHL Job Type field) |
| Door-to-Door + ½-hour callout charge | ✅ implemented (auto callout line, configurable minutes) |
| Depot-to-Depot hourly, no callout | ✅ implemented |
| Quote = fixed agreed price (manual, editable) | ✅ implemented |
| Mark invoice paid + crew confirms payment | ✅ implemented (`recordJobPayment`) |
| Cash jobs — just list/delete/cancel | ✅ implemented (no special handling needed) |
| No distinction cash/card/EFTPOS | ✅ matches design |
| **3-hour / $660 minimum charge** | ✅ implemented 2026-06-21 (admin toggle + amount, floors the helper) |
| **Crew "pay time" breakdown** | ⛔ parked — see §1 below |
| **Automatic 1/3–1/3–1/3 partial schedule** | ✅ implemented 2026-06-21 — see §2 below |

---

## §1. Crew "pay time" breakdown (PARKED)

**Rod's requirement:** crew are paid **depot-to-depot** for every job type (i.e. worked
time **plus** the ~30 min travel that the callout covers — "to cover wages to and from
job, no profit"). Crew should be able to **input total job time (incl. callout)**, input
the **actual worked time**, and **see/amend every detail**. There's also a **3-hour
minimum** on jobs.

**Why parked:** this is a **crew payroll** concern, distinct from client invoicing. The app
currently tracks worked time (TimeTracker: clock in/out, start/end times) and feeds hours
into the invoice helper, but it does **not** compute or display a separate "pay time"
(worked + travel) figure for the crew, nor a payroll view.

**Rough future shape (not designed yet):**
- A "pay time" derived value = worked time + travel allowance (callout minutes), shown to
  crew on the job/timesheet screen, e.g. `Job time: 2h — Pay time: 2h 30m (incl. travel)`.
- Editable worked vs total time on the timesheet (crew can amend).
- Decide: is this just a display, or does it drive an actual payroll export/report?
- Relationship to the minimum charge (3h) — does crew pay also have a 3h floor?

**Open questions for Rod:** is pay-time only for his eyes or shown to crew? Does it need a
payroll export, or just on-screen visibility?

---

## §2. Automatic 1/3–1/3–1/3 partial-payment schedule (IMPLEMENTED 2026-06-21)

**Built using GHL's native `paymentSchedule` on a single invoice** (confirmed via
`createInvoiceSchedule.json`): `createJobInvoice` adds
`paymentSchedule: { type: 'percentage', schedules: [{dueDate, value}] }` with a 33/33/34
split when the crew ticks "Split into 3 payments" AND the tenant's
`invoice_partial_payment_enabled` flag is on. Due dates auto-derive to today / +1 day /
+21 days. GHL computes the per-instalment dollar amounts and the invoice auto-sends
(SMS+email) so the client gets one link covering all three. No extra migration (reuses the
existing flag). Future tweaks if Rod asks: adjustable split %, operator-set milestone dates.

--- original investigation kept below for reference ---


**Rod's requirement:** big / interstate / intrastate jobs take **1/3 deposit, 1/3 on
pickup, 1/3 on delivery** (usually bank transfer, sometimes card).

### What's already implemented
- **Recording partial payments works today.** `recordJobPayment` posts any `amount` to GHL
  `POST /invoices/:id/record-payment`, so crew/admin can record 1/3 now, another 1/3
  later, etc. GHL tracks the invoice as partially paid → paid (the `InvoicePartiallyPaid`
  webhook exists).
- A `Partial Payments (Interstate)` **toggle exists** in admin billing rules
  (`invoice_partial_payment_enabled`) and is returned by `getBillingRules` — **but nothing
  consumes it.** Its description claims it "adds a 1/3–1/3–1/3 schedule," which is currently
  **not true** (the flag is decorative). Either wire it up or fix the copy.

### What's missing
An **automatic** 1/3–1/3–1/3 milestone schedule (deposit / pickup / delivery) generated
when creating an invoice for a large job.

### GHL API options (investigated)
- `POST /invoices/.../record-payment` — records arbitrary partial amounts. ✅ already used.
- **Invoice Schedule API** (`create_invoice_schedule`) — this is **recurring / time-based**
  (frequency + template + contact), meant for subscriptions. It does **not** fit
  milestone-based 1/3 deposits, so it's the wrong tool here.
- GHL has no native "milestone deposit" schedule primitive that maps cleanly to
  deposit/pickup/delivery.

### Three ways to build it (pick one)
1. **One invoice + three recorded partial payments (lowest effort).** Invoice the full
   amount; the app guides recording 1/3 at each milestone (pre-fills the 1/3 amount). Closest
   to what already works. Downside: the "deposit" is a recorded payment, not a separate
   payable invoice you can send the customer to pay online up front.
2. **Three separate invoices (closest to Rod's mental model).** When partial mode is on and
   the operator confirms, create 3 invoices each = 1/3 of total, titled
   Deposit / Pickup / Delivery, each independently sendable + payable. More moving parts
   (3 GHL invoices per job, tracking which is paid).
3. **One invoice with a deposit + manual follow-ups (hybrid).** Send one invoice, collect a
   1/3 deposit up front (recorded), then record the remaining thirds at pickup/delivery.

**Recommendation:** Option 2 (three invoices) matches Rod's "deposit then pickup then
delivery" most literally and lets the customer actually pay each third online/by transfer.
Option 1 is the fast path if "deposit" can just be a recorded amount rather than a sent
invoice.

### To complete (once an option is chosen)
- Wire the existing `partialPaymentEnabled` flag to actually do something.
- Add the 1/3 split logic to invoice creation (`invoicesController.createJobInvoice`) and/or
  the CreateInvoicePage UI (a "split into 3" action).
- Decide how the 3 parts are tracked back on the job (statuses: deposit paid / pickup paid /
  delivered paid).
- Confirm with Rod whether the split is always exactly 1/3, or operator-adjustable.

**Open questions for Rod:** should each third be a separate invoice the customer can pay
online, or just internal payment tracking? Is it always exactly 1/3, or can amounts vary?
