-- ============================================================
-- 017_notification_settings.sql
-- Per-tenant notification toggles stored on the tenant row.
-- All default to true — admin can disable any type from the panel.
-- ============================================================

ALTER TABLE mh_pwa_tenants
  ADD COLUMN IF NOT EXISTS notif_crew_job_assigned      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_admin_status_changed   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_admin_invoice_created  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_admin_invoice_sent     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_admin_invoice_deleted  BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN mh_pwa_tenants.notif_crew_job_assigned     IS 'Push crew when a job is assigned to them via GHL.';
COMMENT ON COLUMN mh_pwa_tenants.notif_admin_status_changed  IS 'Push admins when crew updates a job status.';
COMMENT ON COLUMN mh_pwa_tenants.notif_admin_invoice_created IS 'Push admins when crew creates an invoice.';
COMMENT ON COLUMN mh_pwa_tenants.notif_admin_invoice_sent    IS 'Push admins when crew sends an invoice.';
COMMENT ON COLUMN mh_pwa_tenants.notif_admin_invoice_deleted IS 'Push admins when crew deletes an invoice.';
