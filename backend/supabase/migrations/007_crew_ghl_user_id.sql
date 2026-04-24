-- ============================================================
-- 007_crew_ghl_user_id.sql
-- Adds ghl_user_id to mh_pwa_crew_users so that the
-- OpportunityAssignedToUpdate webhook (which sends a GHL user/staff
-- ID in the `assignedTo` field) can be resolved to a crew member.
-- ============================================================

ALTER TABLE mh_pwa_crew_users
  ADD COLUMN IF NOT EXISTS ghl_user_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_mh_pwa_crew_users_ghl_user_id
  ON mh_pwa_crew_users (ghl_user_id);

COMMENT ON COLUMN mh_pwa_crew_users.ghl_user_id IS
  'GHL staff/user account ID (from assignedTo field on opportunities). '
  'Distinct from ghl_contact_id which is the contact record ID.';
