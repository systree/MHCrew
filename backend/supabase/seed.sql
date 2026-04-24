-- ============================================================
-- seed.sql
-- Seed realistic test data for local development and testing.
-- Run AFTER migrations. Run nuke.sql first if re-seeding.
-- ============================================================

-- ============================================================
-- CREW USERS
-- Passwords/PINs are set via the app auth flow (OTP + PIN).
-- These rows are created here without pin_hash so the first
-- login via OTP will trigger PIN setup automatically.
-- ============================================================

INSERT INTO mh_pwa_crew_users (id, phone, full_name, role, ghl_contact_id, is_active)
VALUES
  ('11111111-0000-0000-0000-000000000001', '+61411111001', 'Jake Morrison',  'lead',  'ghl-contact-crew-001', true),
  ('11111111-0000-0000-0000-000000000002', '+61411111002', 'Sam Rivera',     'crew',  'ghl-contact-crew-002', true),
  ('11111111-0000-0000-0000-000000000003', '+61411111003', 'Mia Chen',       'crew',  'ghl-contact-crew-003', true),
  ('11111111-0000-0000-0000-000000000004', '+61411111004', 'Liam Nguyen',    'crew',  'ghl-contact-crew-004', true),
  ('11111111-0000-0000-0000-000000000005', '+61411111005', 'Admin User',     'admin', 'ghl-contact-admin-001', true);


-- ============================================================
-- JOBS
-- A mix of statuses and dates to test the dashboard grouping.
-- ============================================================

INSERT INTO mh_pwa_jobs (
  id, ghl_job_id, ghl_contact_id,
  customer_name, pickup_address, dropoff_address,
  scheduled_date, status, notes
)
VALUES

  -- TODAY — assigned (not started)
  (
    '22222222-0000-0000-0000-000000000001',
    'ghl-opp-001', 'ghl-customer-001',
    'David & Sarah Thompson',
    '12 Banksia Ave, Bondi NSW 2026',
    '88 Harbour St, Pyrmont NSW 2009',
    now()::date + time '08:00', 'assigned',
    '3-bedroom house. Piano on ground floor. Stairs at destination.'
  ),

  -- TODAY — in progress
  (
    '22222222-0000-0000-0000-000000000002',
    'ghl-opp-002', 'ghl-customer-002',
    'Marcus Liu',
    '5 Ocean Drive, Manly NSW 2095',
    '301 George St, Sydney NSW 2000',
    now()::date + time '10:00', 'in_progress',
    '1-bedroom apartment. Access code: 4821. No lift at pickup.'
  ),

  -- TODAY — completed
  (
    '22222222-0000-0000-0000-000000000003',
    'ghl-opp-003', 'ghl-customer-003',
    'Priya Sharma',
    '77 King St, Newtown NSW 2042',
    '22 Glebe Point Rd, Glebe NSW 2037',
    now()::date + time '07:00', 'completed',
    'Office relocation. 10 desks + chairs.'
  ),

  -- TOMORROW — assigned
  (
    '22222222-0000-0000-0000-000000000004',
    'ghl-opp-004', 'ghl-customer-004',
    'Emma & Tom Walsh',
    '9 Palm Crescent, Cronulla NSW 2230',
    '14 Fern St, Hurstville NSW 2220',
    (now()::date + interval '1 day') + time '09:00', 'assigned',
    '4-bedroom house. Fragile items — antique dining set. Wrap carefully.'
  ),

  -- TOMORROW — assigned
  (
    '22222222-0000-0000-0000-000000000005',
    'ghl-opp-005', 'ghl-customer-005',
    'Ben Carter',
    '3 Sunset Blvd, Coogee NSW 2034',
    '110 Military Rd, Neutral Bay NSW 2089',
    (now()::date + interval '1 day') + time '13:00', 'assigned',
    '2-bedroom apartment. Parking permit needed — customer will arrange.'
  ),

  -- DAY AFTER TOMORROW — assigned
  (
    '22222222-0000-0000-0000-000000000006',
    'ghl-opp-006', 'ghl-customer-006',
    'Anita Patel',
    '55 Baker St, Parramatta NSW 2150',
    '200 Pacific Hwy, Hornsby NSW 2077',
    (now()::date + interval '2 days') + time '08:30', 'assigned',
    'Studio apartment. Easy access both ends.'
  ),

  -- CANCELLED — for testing cancelled state display
  (
    '22222222-0000-0000-0000-000000000007',
    'ghl-opp-007', 'ghl-customer-007',
    'Oliver Grant',
    '8 Rose St, Redfern NSW 2016',
    '42 Crown St, Surry Hills NSW 2010',
    now()::date + time '11:00', 'cancelled',
    NULL
  );


-- ============================================================
-- JOB CREW ASSIGNMENTS
-- Assign crew members to jobs
-- ============================================================

INSERT INTO mh_pwa_job_crew_assignments (job_id, crew_user_id, assigned_by)
VALUES
  -- Job 1 (today, assigned): Jake (lead) + Sam
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'system'),
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'system'),

  -- Job 2 (today, in_progress): Jake + Mia
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'system'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'system'),

  -- Job 3 (today, completed): Sam + Liam
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'system'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000004', 'system'),

  -- Job 4 (tomorrow): Jake + Sam + Liam
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'system'),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', 'system'),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', 'system'),

  -- Job 5 (tomorrow): Mia + Sam
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000003', 'system'),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'system'),

  -- Job 6 (day after tomorrow): Liam solo
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000004', 'system'),

  -- Job 7 (cancelled): Jake
  ('22222222-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000001', 'system');


-- ============================================================
-- TIMESHEETS
-- Seed a completed timesheet for job 3 (completed job)
-- ============================================================

INSERT INTO mh_pwa_timesheets (job_id, crew_user_id, clock_in, clock_out, break_minutes)
VALUES
  (
    '22222222-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000002',
    now()::date + time '07:05',
    now()::date + time '09:45',
    15
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000004',
    now()::date + time '07:10',
    now()::date + time '09:45',
    15
  );


-- ============================================================
-- SUMMARY
-- After running this seed:
--
-- Crew phones you can log in with (OTP flow):
--   +61411111001  Jake Morrison  (lead)
--   +61411111002  Sam Rivera     (crew)
--   +61411111003  Mia Chen       (crew)
--   +61411111004  Liam Nguyen    (crew)
--
-- Jobs visible to Jake (+61411111001):
--   - Today 08:00   David & Sarah Thompson  [assigned]
--   - Today 10:00   Marcus Liu              [in_progress]
--   - Tomorrow 09:00 Emma & Tom Walsh       [assigned]
--   - Cancelled      Oliver Grant           [cancelled]
--
-- Jobs visible to Sam (+61411111002):
--   - Today 08:00   David & Sarah Thompson  [assigned]
--   - Today 07:00   Priya Sharma            [completed]
--   - Tomorrow 09:00 Emma & Tom Walsh       [assigned]
--   - Tomorrow 13:00 Ben Carter             [assigned]
-- ============================================================
