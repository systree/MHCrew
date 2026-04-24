-- ============================================================
-- 003_indexes.sql
-- Performance indexes for Mover Hero Crew App
-- Depends on: 002_tables.sql
-- ============================================================

-- ------------------------------------------------------------
-- mh_pwa_jobs
-- ------------------------------------------------------------

CREATE INDEX idx_mh_pwa_jobs_ghl_job_id
  ON mh_pwa_jobs (ghl_job_id);

CREATE INDEX idx_mh_pwa_jobs_status
  ON mh_pwa_jobs (status);

CREATE INDEX idx_mh_pwa_jobs_scheduled_date
  ON mh_pwa_jobs (scheduled_date);

CREATE INDEX idx_mh_pwa_jobs_ghl_contact_id
  ON mh_pwa_jobs (ghl_contact_id);

-- ------------------------------------------------------------
-- mh_pwa_job_crew_assignments
-- ------------------------------------------------------------

CREATE INDEX idx_mh_pwa_job_crew_assignments_job_id
  ON mh_pwa_job_crew_assignments (job_id);

CREATE INDEX idx_mh_pwa_job_crew_assignments_crew_user_id
  ON mh_pwa_job_crew_assignments (crew_user_id);

-- ------------------------------------------------------------
-- mh_pwa_timesheets
-- ------------------------------------------------------------

CREATE INDEX idx_mh_pwa_timesheets_job_id
  ON mh_pwa_timesheets (job_id);

CREATE INDEX idx_mh_pwa_timesheets_crew_user_id
  ON mh_pwa_timesheets (crew_user_id);

-- ------------------------------------------------------------
-- mh_pwa_job_photos
-- ------------------------------------------------------------

CREATE INDEX idx_mh_pwa_job_photos_job_id
  ON mh_pwa_job_photos (job_id);

CREATE INDEX idx_mh_pwa_job_photos_ghl_synced
  ON mh_pwa_job_photos (ghl_synced)
  WHERE ghl_synced = false;

-- ------------------------------------------------------------
-- mh_pwa_job_locations
-- ------------------------------------------------------------

CREATE INDEX idx_mh_pwa_job_locations_job_id
  ON mh_pwa_job_locations (job_id);

CREATE INDEX idx_mh_pwa_job_locations_crew_user_id
  ON mh_pwa_job_locations (crew_user_id);

CREATE INDEX idx_mh_pwa_job_locations_synced_to_ghl
  ON mh_pwa_job_locations (synced_to_ghl)
  WHERE synced_to_ghl = false;

-- ------------------------------------------------------------
-- mh_pwa_ghl_sync_log
-- ------------------------------------------------------------

CREATE INDEX idx_mh_pwa_ghl_sync_log_status
  ON mh_pwa_ghl_sync_log (status);

CREATE INDEX idx_mh_pwa_ghl_sync_log_direction
  ON mh_pwa_ghl_sync_log (direction);

CREATE INDEX idx_mh_pwa_ghl_sync_log_created_at
  ON mh_pwa_ghl_sync_log (created_at DESC);
