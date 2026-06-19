-- 020: add invoice_show_estimates flag to mh_pwa_tenants
ALTER TABLE mh_pwa_tenants
  ADD COLUMN IF NOT EXISTS invoice_show_estimates BOOLEAN NOT NULL DEFAULT false;
