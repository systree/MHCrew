-- ============================================================
-- 009_tenants.sql
-- Tenant registry — one row per GHL sub-account that has
-- installed the Mover Hero app via the GHL marketplace.
-- location_id is the canonical tenant key used throughout
-- the entire system.
-- ============================================================

CREATE TABLE IF NOT EXISTS mh_pwa_tenants (
  location_id         text        PRIMARY KEY,              -- GHL sub-account ID (tenant key)
  company_id          text,                                 -- GHL agency/company ID
  company_name        text,
  app_id              text,                                 -- GHL app ID
  installing_user_id  text,                                 -- GHL user who triggered install
  plan_id             text,                                 -- Current plan ID
  is_active           boolean     NOT NULL DEFAULT true,    -- false after UNINSTALL
  on_trial            boolean     NOT NULL DEFAULT false,
  trial_duration_days integer,
  trial_starts_at     timestamptz,
  trial_ends_at       timestamptz,                          -- computed: trial_starts_at + duration
  is_whitelabel       boolean     NOT NULL DEFAULT false,
  whitelabel_domain   text,
  installed_at        timestamptz NOT NULL DEFAULT now(),
  uninstalled_at      timestamptz,
  raw_install_payload jsonb,                                -- full INSTALL payload for reference
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mh_pwa_tenants_company
  ON mh_pwa_tenants (company_id);

CREATE INDEX IF NOT EXISTS idx_mh_pwa_tenants_active
  ON mh_pwa_tenants (is_active);

COMMENT ON TABLE mh_pwa_tenants IS
  'One row per GHL sub-account that has installed the Mover Hero PWA app. '
  'location_id is the tenant discriminator used on crew_users, jobs, and sync_log.';
