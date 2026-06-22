-- ============================================================
-- 026_drop_inventory_drafts.sql
-- Inventory was extracted into its own standalone app (MHInventory, mh_inv_
-- tables). The crew app no longer reads or writes mh_pwa_inventory_drafts —
-- drop the now-orphaned table.
--
-- NOTE: the `model` column on mh_pwa_location_custom_fields (migration 023) is
-- retained — it's generic and still used by provisioning / field-cache code.
-- ============================================================

DROP TABLE IF EXISTS mh_pwa_inventory_drafts;
