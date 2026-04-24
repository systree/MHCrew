-- Migration 013: Activity log table for file + DB logging
-- Tracks all critical system events and user activity.
-- Written fire-and-forget from the app — never blocks request handling.

CREATE TABLE IF NOT EXISTS mh_pwa_activity_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  text,
  user_id      uuid,
  category     text NOT NULL,  -- auth | job | webhook | admin | system
  action       text NOT NULL,  -- e.g. 'login_success', 'status_update', 'webhook_received'
  level        text NOT NULL DEFAULT 'info',  -- info | warn | error
  meta         jsonb,          -- arbitrary structured context
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_location_time
  ON mh_pwa_activity_log (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_time
  ON mh_pwa_activity_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_category
  ON mh_pwa_activity_log (category, created_at DESC);
