-- ============================================================
-- 022_inventory_drafts.sql
-- Stores customer-submitted moving inventory from the inventory-tool app.
-- One draft per contact per location; autosaved as the customer fills it in,
-- then marked 'submitted' once finalised and written back to GHL.
-- ============================================================

CREATE TABLE IF NOT EXISTS mh_pwa_inventory_drafts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT        NOT NULL,
  contact_id  TEXT        NOT NULL,
  opp_id      TEXT,
  items       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'submitted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_drafts_location ON mh_pwa_inventory_drafts (location_id);

COMMENT ON TABLE  mh_pwa_inventory_drafts            IS 'Customer-submitted moving inventory. One row per contact per location.';
COMMENT ON COLUMN mh_pwa_inventory_drafts.opp_id     IS 'GHL opportunity id from the signed link token; inventory is written to both the contact and this opportunity on submit.';
COMMENT ON COLUMN mh_pwa_inventory_drafts.items      IS 'Map of itemName -> quantity (matches the inventory-tool store shape).';
COMMENT ON COLUMN mh_pwa_inventory_drafts.status     IS 'draft while the customer is filling it in; submitted once finalised and pushed to GHL.';
