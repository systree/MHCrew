-- ============================================================
-- 021_multi_location_phone.sql
-- Allows the same phone number to exist in multiple locations.
--
-- Original schema had phone as UNIQUE across the entire table.
-- With multi-tenancy, the same person can be a crew member in
-- two different GHL sub-accounts (location_ids), so the unique
-- constraint must be scoped to (phone, location_id) instead.
-- ============================================================

-- Drop the global unique constraint on phone
ALTER TABLE mh_pwa_crew_users
  DROP CONSTRAINT IF EXISTS mh_pwa_crew_users_phone_key;

-- Add a composite unique constraint: one row per (phone, location)
ALTER TABLE mh_pwa_crew_users
  ADD CONSTRAINT mh_pwa_crew_users_phone_location_unique
  UNIQUE (phone, location_id);
