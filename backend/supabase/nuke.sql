-- ============================================================
-- nuke.sql
-- Wipe ALL data from all mh_pwa_ tables.
-- Preserves table structure, enums, indexes, and RLS policies.
-- Run this to reset to a clean state without re-running migrations.
-- ============================================================

-- Truncate in dependency order (children first, parents last)
-- CASCADE handles any FK references automatically.

TRUNCATE TABLE
  mh_pwa_activity_log,
  mh_pwa_ghl_sync_log,
  mh_pwa_job_locations,
  mh_pwa_job_photos,
  mh_pwa_timesheets,
  mh_pwa_job_crew_assignments,
  mh_pwa_jobs,
  mh_pwa_crew_users,
  mh_pwa_otp_tokens,
  mh_pwa_location_custom_fields,
  mh_pwa_pipeline_stages,
  mh_pwa_tenants,
  mh_pwa_push_subscriptions
CASCADE;
