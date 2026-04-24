-- ============================================================
-- 001_enums.sql
-- Custom Postgres enum types for Mover Hero Crew App
-- ============================================================

-- Roles a crew member can hold within the system
CREATE TYPE crew_role AS ENUM (
  'crew',   -- Standard crew member
  'lead',   -- Job lead / foreman
  'admin'   -- Administrative access
);

-- Lifecycle states of a job
CREATE TYPE job_status AS ENUM (
  'assigned',    -- Job assigned to crew, not yet started
  'enroute',     -- Crew is travelling to pickup location
  'arrived',     -- Crew has arrived on site
  'in_progress', -- Job is actively underway
  'completed',   -- Job successfully finished
  'cancelled'    -- Job was cancelled
);

-- Categories of photos attached to a job
CREATE TYPE photo_type AS ENUM (
  'before',  -- Pre-move condition photo
  'after',   -- Post-move condition photo
  'damage',  -- Documented damage
  'item',    -- Specific item photo
  'other'    -- Uncategorised photo
);

-- Events that cause a location ping to be recorded
CREATE TYPE location_trigger AS ENUM (
  'app_open',   -- User opened the app
  'enroute',    -- Status changed to en-route
  'arrived',    -- Status changed to arrived
  'in_transit', -- Crew moving items between locations
  'interval'    -- Periodic background location update
);

-- Direction of a GHL sync event
CREATE TYPE sync_direction AS ENUM (
  'inbound',  -- Data received from GHL
  'outbound'  -- Data sent to GHL
);

-- Outcome of a GHL sync attempt
CREATE TYPE sync_status AS ENUM (
  'pending', -- Not yet attempted or awaiting retry
  'success', -- Successfully synced
  'failed'   -- All attempts exhausted
);
