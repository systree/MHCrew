-- ============================================================
-- 015_tenant_invoice_settings.sql
-- Per-location invoice configuration stored on the tenant row.
-- Seeded from GHL Location API on INSTALL; admin can override later.
-- ============================================================

ALTER TABLE mh_pwa_tenants
  ADD COLUMN IF NOT EXISTS invoice_number_prefix      text    NOT NULL DEFAULT 'INV-',
  ADD COLUMN IF NOT EXISTS invoice_business_name      text,
  ADD COLUMN IF NOT EXISTS invoice_business_logo_url  text,
  ADD COLUMN IF NOT EXISTS invoice_business_phone     text,
  ADD COLUMN IF NOT EXISTS invoice_business_website   text,
  ADD COLUMN IF NOT EXISTS invoice_business_address   jsonb,
  ADD COLUMN IF NOT EXISTS invoice_taxes_enabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_tax_name           text    NOT NULL DEFAULT 'Tax',
  ADD COLUMN IF NOT EXISTS invoice_tax_rate           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_tax_calculation    text    NOT NULL DEFAULT 'exclusive';

COMMENT ON COLUMN mh_pwa_tenants.invoice_number_prefix     IS 'Prefix prepended to GHL-generated invoice numbers, e.g. ''INV-''.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_business_name     IS 'Business name shown on invoices. Seeded from GHL Location API.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_business_logo_url IS 'Logo URL shown on invoices. Seeded from GHL Location API.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_business_phone    IS 'Business phone shown on invoices.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_business_website  IS 'Business website shown on invoices.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_business_address  IS 'Business address jsonb: {addressLine1, city, state, postalCode, countryCode}.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_taxes_enabled     IS 'When true, a tax entry is added to each invoice line item.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_tax_name          IS 'Tax label, e.g. ''GST'', ''Tax'', ''Sales Tax''.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_tax_rate          IS 'Tax rate as a percentage, e.g. 10 for 10%.';
COMMENT ON COLUMN mh_pwa_tenants.invoice_tax_calculation   IS 'Tax calculation method: ''exclusive'' or ''inclusive''.';
