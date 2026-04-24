-- ============================================================
-- 005_functions.sql
-- Helper functions and triggers for Mover Hero Crew App
-- Depends on: 002_tables.sql
-- ============================================================

-- ------------------------------------------------------------
-- update_updated_at()
-- Generic trigger function that stamps updated_at = now()
-- on every UPDATE. Attach to any table with an updated_at column.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Attach the trigger to mh_pwa_crew_users
-- ------------------------------------------------------------
CREATE TRIGGER trg_mh_pwa_crew_users_updated_at
  BEFORE UPDATE ON mh_pwa_crew_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- Attach the trigger to mh_pwa_jobs
-- ------------------------------------------------------------
CREATE TRIGGER trg_mh_pwa_jobs_updated_at
  BEFORE UPDATE ON mh_pwa_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
