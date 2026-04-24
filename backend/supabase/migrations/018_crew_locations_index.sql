-- ============================================================
-- 018_crew_locations_index.sql
-- Performance index for "last location per driver per job" queries.
-- Used by GET /api/admin/crew-locations.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_job_locations_driver_job_time
  ON mh_pwa_job_locations(crew_user_id, job_id, timestamp DESC);
