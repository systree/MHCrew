-- Add pipeline_id to tenants
ALTER TABLE mh_pwa_tenants ADD COLUMN IF NOT EXISTS pipeline_id TEXT;

-- Pipeline stages table for admin stage mapping
CREATE TABLE IF NOT EXISTS mh_pwa_pipeline_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  TEXT NOT NULL,
  pipeline_id  TEXT NOT NULL,
  stage_id     TEXT NOT NULL,
  stage_name   TEXT NOT NULL,
  job_status   TEXT NULL CHECK (job_status IN ('assigned','enroute','arrived','in_progress','completed','cancelled')),
  sort_order   INT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_location ON mh_pwa_pipeline_stages (location_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_location_status ON mh_pwa_pipeline_stages (location_id, job_status);
