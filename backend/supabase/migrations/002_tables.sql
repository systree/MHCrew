-- ============================================================
-- 002_tables.sql
-- Core tables for Mover Hero Crew App
-- Depends on: 001_enums.sql
-- All tables use the mh_pwa_ prefix to avoid conflicts.
-- ============================================================

-- ------------------------------------------------------------
-- mh_pwa_crew_users
-- Represents every crew member, lead, or admin who can log in
-- to the PWA. Linked to a GHL contact for CRM sync.
-- ------------------------------------------------------------
CREATE TABLE mh_pwa_crew_users (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text        UNIQUE NOT NULL,          -- Used as the login identifier
  pin_hash         text,                                 -- Bcrypt hash of the 4-digit PIN
  full_name        text        NOT NULL DEFAULT '',
  role             crew_role   NOT NULL DEFAULT 'crew',
  ghl_contact_id   text,                                 -- Corresponding GHL contact id
  is_active        boolean     NOT NULL DEFAULT true,    -- Soft-delete / suspension flag
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- mh_pwa_jobs
-- A single moving job pulled from / synced with GHL.
-- The raw GHL payload is preserved for reference and re-sync.
-- ------------------------------------------------------------
CREATE TABLE mh_pwa_jobs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_job_id          text        UNIQUE NOT NULL,       -- Canonical GHL opportunity/job id
  ghl_contact_id      text,                              -- GHL contact associated with the job
  customer_name       text,
  pickup_address      text,
  dropoff_address     text,
  scheduled_date      timestamptz,
  status              job_status  NOT NULL DEFAULT 'assigned',
  notes               text,
  cancellation_reason text,
  raw_ghl_payload     jsonb,                             -- Full inbound GHL payload for auditing
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- mh_pwa_job_crew_assignments
-- Many-to-many join between jobs and crew members.
-- A job can have multiple crew; a crew member can have multiple jobs.
-- ------------------------------------------------------------
CREATE TABLE mh_pwa_job_crew_assignments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid        NOT NULL REFERENCES mh_pwa_jobs(id)       ON DELETE CASCADE,
  crew_user_id   uuid        NOT NULL REFERENCES mh_pwa_crew_users(id) ON DELETE CASCADE,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  assigned_by    text,                                  -- Identifier (user id or system) that made the assignment
  UNIQUE (job_id, crew_user_id)
);

-- ------------------------------------------------------------
-- mh_pwa_timesheets
-- Clock-in / clock-out records per crew member per job.
-- total_minutes is computed automatically when clock_out is set.
-- ------------------------------------------------------------
CREATE TABLE mh_pwa_timesheets (
  id             uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid     NOT NULL REFERENCES mh_pwa_jobs(id)       ON DELETE CASCADE,
  crew_user_id   uuid     NOT NULL REFERENCES mh_pwa_crew_users(id) ON DELETE CASCADE,
  clock_in       timestamptz NOT NULL,
  clock_out      timestamptz,
  break_minutes  integer  NOT NULL DEFAULT 0,
  -- Derived column: total paid minutes = elapsed minutes minus break
  total_minutes  integer  GENERATED ALWAYS AS (
    CASE
      WHEN clock_out IS NOT NULL
      THEN EXTRACT(EPOCH FROM (clock_out - clock_in))::integer / 60 - break_minutes
      ELSE NULL
    END
  ) STORED,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- mh_pwa_job_photos
-- Photos captured by crew and stored in Supabase Storage.
-- ghl_synced tracks whether the photo URL has been pushed to GHL.
-- ------------------------------------------------------------
CREATE TABLE mh_pwa_job_photos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid        NOT NULL REFERENCES mh_pwa_jobs(id)       ON DELETE CASCADE,
  crew_user_id   uuid        NOT NULL REFERENCES mh_pwa_crew_users(id) ON DELETE CASCADE,
  storage_path   text        NOT NULL,                   -- Path within Supabase Storage bucket
  public_url     text        NOT NULL,                   -- Publicly accessible URL
  photo_type     photo_type  NOT NULL DEFAULT 'other',
  ghl_synced     boolean     NOT NULL DEFAULT false,
  uploaded_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- mh_pwa_job_locations
-- GPS pings associated with crew activity on a job.
-- synced_to_ghl tracks whether this ping has been forwarded.
-- ------------------------------------------------------------
CREATE TABLE mh_pwa_job_locations (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid              NOT NULL REFERENCES mh_pwa_jobs(id)       ON DELETE CASCADE,
  crew_user_id    uuid              NOT NULL REFERENCES mh_pwa_crew_users(id) ON DELETE CASCADE,
  latitude        float8            NOT NULL,
  longitude       float8            NOT NULL,
  accuracy        float8,                                -- Accuracy radius in metres, if available
  trigger_event   location_trigger  NOT NULL,
  synced_to_ghl   boolean           NOT NULL DEFAULT false,
  timestamp       timestamptz       NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- mh_pwa_ghl_sync_log
-- Audit log for every inbound and outbound GHL sync event.
-- Supports retry logic via attempts / last_attempted_at.
-- ------------------------------------------------------------
CREATE TABLE mh_pwa_ghl_sync_log (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  direction           sync_direction NOT NULL,
  event_type          text          NOT NULL,             -- e.g. 'job.created', 'photo.uploaded'
  payload             jsonb,                              -- Raw payload for debugging / replay
  status              sync_status   NOT NULL DEFAULT 'pending',
  attempts            integer       NOT NULL DEFAULT 0,
  last_attempted_at   timestamptz,
  error_message       text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);
