-- ============================================================
-- 008_multi_tenancy.sql
-- Adds location_id (GHL sub-account ID) to core tables so that
-- a single backend can serve multiple GHL sub-accounts without
-- any data bleed between tenants.
-- ============================================================

-- crew_users: each crew member belongs to one GHL sub-account
ALTER TABLE mh_pwa_crew_users
  ADD COLUMN IF NOT EXISTS location_id text;

-- jobs: each job belongs to the sub-account that created the opportunity
ALTER TABLE mh_pwa_jobs
  ADD COLUMN IF NOT EXISTS location_id text;

-- sync_log: tag log entries per sub-account for easier debugging
ALTER TABLE mh_pwa_ghl_sync_log
  ADD COLUMN IF NOT EXISTS location_id text;

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_mh_pwa_crew_users_location
  ON mh_pwa_crew_users (location_id);

CREATE INDEX IF NOT EXISTS idx_mh_pwa_jobs_location
  ON mh_pwa_jobs (location_id);

CREATE INDEX IF NOT EXISTS idx_mh_pwa_ghl_sync_log_location
  ON mh_pwa_ghl_sync_log (location_id);

-- Compound index: tenant + status for dashboard-style queries
CREATE INDEX IF NOT EXISTS idx_mh_pwa_jobs_location_status
  ON mh_pwa_jobs (location_id, status);

COMMENT ON COLUMN mh_pwa_crew_users.location_id IS
  'GHL sub-account (location) ID. Tenant discriminator for multi-tenancy.';

COMMENT ON COLUMN mh_pwa_jobs.location_id IS
  'GHL sub-account (location) ID. Tenant discriminator for multi-tenancy.';
