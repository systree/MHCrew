-- ============================================================
-- 016_push_subscriptions.sql
-- Stores Web Push subscriptions per user per tenant.
-- One user can have multiple subscriptions (different devices/browsers).
-- ============================================================

CREATE TABLE IF NOT EXISTS mh_pwa_push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES mh_pwa_crew_users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_location ON mh_pwa_push_subscriptions (location_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user     ON mh_pwa_push_subscriptions (user_id);

COMMENT ON TABLE  mh_pwa_push_subscriptions             IS 'Web Push subscriptions. One row per device/browser per crew user.';
COMMENT ON COLUMN mh_pwa_push_subscriptions.endpoint    IS 'Push service endpoint URL (browser-specific).';
COMMENT ON COLUMN mh_pwa_push_subscriptions.p256dh      IS 'P-256 DH public key (base64url).';
COMMENT ON COLUMN mh_pwa_push_subscriptions.auth        IS 'Auth secret (base64url).';
