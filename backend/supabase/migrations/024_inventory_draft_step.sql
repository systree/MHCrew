-- ============================================================
-- 024_inventory_draft_step.sql
-- Remembers which wizard step the customer was on, so reopening the link
-- resumes exactly where they left off (not just their selected items).
-- ============================================================

ALTER TABLE mh_pwa_inventory_drafts
  ADD COLUMN IF NOT EXISTS step INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN mh_pwa_inventory_drafts.step IS 'Wizard step index the customer last reached (0 = intro). Used to resume mid-flow.';
