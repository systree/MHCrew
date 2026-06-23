-- ============================================================
-- 027_moving_inventory.sql
-- The job item summary now sources from the GHL opportunity custom field
-- "Moving Inventory" (opportunity.moving_inventory) instead of the old
-- "Item Summary" field. Add the new column and drop the now-unused one.
--
-- NOTE: data is not migrated — moving_inventory is populated from the GHL
-- field on the next webhook event / manual Sync Jobs.
-- ============================================================

ALTER TABLE mh_pwa_jobs
  ADD COLUMN IF NOT EXISTS moving_inventory text;

ALTER TABLE mh_pwa_jobs
  DROP COLUMN IF EXISTS item_summary;
