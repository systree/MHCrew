-- ============================================================
-- 010_jobs_extra_fields.sql
-- Adds customer_phone, estimated_value, item_summary, crew_notes
-- to mh_pwa_jobs so the PWA can display all job detail fields.
-- ============================================================

ALTER TABLE mh_pwa_jobs
  ADD COLUMN IF NOT EXISTS customer_phone  text,
  ADD COLUMN IF NOT EXISTS estimated_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS item_summary    text,
  ADD COLUMN IF NOT EXISTS crew_notes      text;
