-- ============================================================
-- 011_location_custom_fields.sql
-- Persists GHL custom field definitions per tenant location.
-- Replaces the in-memory fieldDefCache in ghlHandler.js.
-- ============================================================

CREATE TABLE mh_pwa_location_custom_fields (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  text        NOT NULL,
  field_id     text        NOT NULL,   -- GHL custom field UUID
  field_key    text        NOT NULL,   -- e.g. "opportunity.pickup_address"
  field_label  text,                   -- Human-readable label (for debugging)
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, field_id)
);

CREATE INDEX idx_lcf_location ON mh_pwa_location_custom_fields (location_id);
