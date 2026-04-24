-- ============================================================
-- 006_otp_tokens.sql
-- OTP token storage for custom phone-based authentication.
-- Replaces Supabase Auth OTP — Supabase is DB/Storage only.
-- ============================================================

CREATE TABLE mh_pwa_otp_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text        NOT NULL,
  otp_hash    text        NOT NULL,    -- SHA-256 hex of the raw 6-digit OTP
  expires_at  timestamptz NOT NULL,    -- now() + 10 minutes at insert time
  used        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lookup index: find the latest valid token for a phone quickly
CREATE INDEX idx_mh_pwa_otp_tokens_lookup
  ON mh_pwa_otp_tokens (phone, used, expires_at);

-- Auto-cleanup: tokens older than 1 hour are irrelevant.
-- Run a pg_cron job or call this function from a maintenance script.
-- Alternatively, just let the expires_at check handle security;
-- old rows can be purged periodically.
