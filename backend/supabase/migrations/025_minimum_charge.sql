-- ============================================================
-- 025_minimum_charge.sql
-- Per-tenant minimum job charge. When enabled, the invoice billing helper
-- floors the Moving Service line to this amount (e.g. a 3-hour / $660 minimum).
-- ============================================================

ALTER TABLE mh_pwa_tenants
  ADD COLUMN IF NOT EXISTS billing_minimum_charge_enabled BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_minimum_charge_amount  NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN mh_pwa_tenants.billing_minimum_charge_enabled IS 'When true, invoices floor the Moving Service line to billing_minimum_charge_amount.';
COMMENT ON COLUMN mh_pwa_tenants.billing_minimum_charge_amount  IS 'Minimum job charge in dollars (e.g. 660 for a 3-hour minimum).';
