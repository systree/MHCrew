-- Migration 019: Billing rules + job type
-- Apply with: psql $DATABASE_URL < migrations/019_billing_rules.sql

ALTER TABLE mh_pwa_jobs
  ADD COLUMN IF NOT EXISTS job_type TEXT
    CHECK (job_type IN ('door_to_door', 'depot_to_depot', 'quote'));

ALTER TABLE mh_pwa_tenants
  ADD COLUMN IF NOT EXISTS billing_rules_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_callout_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS invoice_partial_payment_enabled BOOLEAN NOT NULL DEFAULT false;
