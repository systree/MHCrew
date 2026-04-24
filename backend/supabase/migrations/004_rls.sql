-- ============================================================
-- 004_rls.sql
-- Row Level Security policies for Mover Hero Crew App
-- Depends on: 002_tables.sql
--
-- Security model:
--   • Each authenticated crew member can only access rows that
--     belong to them (crew_user_id = auth.uid()) or jobs they
--     are explicitly assigned to.
--   • The service role (used by the backend API) bypasses RLS
--     automatically in Supabase — no extra policy needed.
-- ============================================================

-- ------------------------------------------------------------
-- Enable RLS on all tables
-- ------------------------------------------------------------
ALTER TABLE mh_pwa_crew_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_pwa_jobs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_pwa_job_crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_pwa_timesheets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_pwa_job_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_pwa_job_locations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_pwa_ghl_sync_log         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- mh_pwa_crew_users policies
-- ============================================================

CREATE POLICY "mh_pwa_crew_users: select own row"
  ON mh_pwa_crew_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "mh_pwa_crew_users: update own row"
  ON mh_pwa_crew_users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- mh_pwa_jobs policies
-- ============================================================

CREATE POLICY "mh_pwa_jobs: select assigned jobs"
  ON mh_pwa_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM mh_pwa_job_crew_assignments jca
      WHERE jca.job_id       = mh_pwa_jobs.id
        AND jca.crew_user_id = auth.uid()
    )
  );

-- ============================================================
-- mh_pwa_job_crew_assignments policies
-- ============================================================

CREATE POLICY "mh_pwa_job_crew_assignments: select own assignments"
  ON mh_pwa_job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (crew_user_id = auth.uid());

-- ============================================================
-- mh_pwa_timesheets policies
-- ============================================================

CREATE POLICY "mh_pwa_timesheets: select own rows"
  ON mh_pwa_timesheets
  FOR SELECT
  TO authenticated
  USING (crew_user_id = auth.uid());

CREATE POLICY "mh_pwa_timesheets: insert own rows"
  ON mh_pwa_timesheets
  FOR INSERT
  TO authenticated
  WITH CHECK (crew_user_id = auth.uid());

CREATE POLICY "mh_pwa_timesheets: update own rows"
  ON mh_pwa_timesheets
  FOR UPDATE
  TO authenticated
  USING (crew_user_id = auth.uid())
  WITH CHECK (crew_user_id = auth.uid());

-- ============================================================
-- mh_pwa_job_photos policies
-- ============================================================

CREATE POLICY "mh_pwa_job_photos: select on assigned jobs"
  ON mh_pwa_job_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM mh_pwa_job_crew_assignments jca
      WHERE jca.job_id       = mh_pwa_job_photos.job_id
        AND jca.crew_user_id = auth.uid()
    )
  );

CREATE POLICY "mh_pwa_job_photos: insert own photos"
  ON mh_pwa_job_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (crew_user_id = auth.uid());

-- ============================================================
-- mh_pwa_job_locations policies
-- ============================================================

CREATE POLICY "mh_pwa_job_locations: select own rows"
  ON mh_pwa_job_locations
  FOR SELECT
  TO authenticated
  USING (crew_user_id = auth.uid());

CREATE POLICY "mh_pwa_job_locations: insert own rows"
  ON mh_pwa_job_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (crew_user_id = auth.uid());

-- ============================================================
-- mh_pwa_ghl_sync_log policies
-- Service role only — no direct crew access.
-- ============================================================

CREATE POLICY "mh_pwa_ghl_sync_log: no direct crew access"
  ON mh_pwa_ghl_sync_log
  FOR ALL
  TO authenticated
  USING (false);
