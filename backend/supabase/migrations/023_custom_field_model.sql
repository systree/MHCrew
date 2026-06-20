-- ============================================================
-- 023_custom_field_model.sql
-- Adds a `model` column to the custom-field UUID cache so contact-model and
-- opportunity-model fields that share a fieldKey (e.g. 'inventory_details')
-- can be told apart when resolving a field UUID for writeback.
--
-- All existing rows were opportunity fields, so they backfill to 'opportunity'
-- via the column default. The (location_id, field_id) unique key is unchanged.
-- ============================================================

ALTER TABLE mh_pwa_location_custom_fields
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'opportunity'
    CHECK (model IN ('opportunity', 'contact'));

COMMENT ON COLUMN mh_pwa_location_custom_fields.model IS 'GHL model the field belongs to (opportunity | contact). Disambiguates fields that share a fieldKey across models.';
