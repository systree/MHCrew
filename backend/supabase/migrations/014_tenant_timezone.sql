-- ============================================================
-- 014_tenant_timezone.sql
-- Add IANA timezone to tenant registry.
-- Populated from the GHL Location API after OAuth tokens are available.
-- Default is Australia/Sydney (most common GHL sub-account location).
-- ============================================================

ALTER TABLE mh_pwa_tenants
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Australia/Sydney';

COMMENT ON COLUMN mh_pwa_tenants.timezone IS
  'IANA timezone name for this GHL sub-account, e.g. ''Australia/Sydney''. '
  'Used to interpret naive datetimes from GHL custom fields and to display '
  'times correctly on crew devices regardless of device locale.';
