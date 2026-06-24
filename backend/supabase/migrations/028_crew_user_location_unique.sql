-- ============================================================
-- 028_crew_user_location_unique.sql
-- Multi-location fix. A GHL agency user has ONE user id shared across all
-- sub-locations, but migration 007 made ghl_user_id GLOBALLY unique. That
-- prevented the same person being a crew member in two locations: the crew
-- sync upserts on ghl_user_id, so syncing into a second location MOVED the row
-- instead of adding one. Scope uniqueness to (ghl_user_id, location_id), matching
-- the multi-location design (migration 021 did the same for phone).
--
-- The non-unique lookup index on ghl_user_id (migration 007) is retained.
--
-- ORDER OF OPS: deploy the matching code first (onConflict 'ghl_user_id,location_id')
-- THEN run this — the DB is shared, so old code using onConflict 'ghl_user_id'
-- would error against the new constraint.
-- ============================================================

ALTER TABLE mh_pwa_crew_users
  DROP CONSTRAINT IF EXISTS mh_pwa_crew_users_ghl_user_id_key;

ALTER TABLE mh_pwa_crew_users
  ADD CONSTRAINT mh_pwa_crew_users_ghl_user_id_location_unique
  UNIQUE (ghl_user_id, location_id);
