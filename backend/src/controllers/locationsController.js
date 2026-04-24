'use strict';

const supabase = require('../services/supabase');
const ghlOutbound = require('../services/ghlOutbound');
const logger = require('../utils/logger');

const VALID_TRIGGER_EVENTS = ['app_open', 'enroute', 'arrived', 'in_transit', 'interval'];
const GHL_TRIGGER_EVENTS   = ['enroute', 'arrived'];

// ---------------------------------------------------------------------------
// logLocation — POST /jobs/:jobId/locations
// ---------------------------------------------------------------------------
async function logLocation(req, res) {
  const { jobId }  = req.params;
  const { latitude, longitude, accuracy, triggerEvent } = req.body;
  const userId     = req.user.userId;
  const locationId = req.user.locationId;

  // Validate required fields
  if (latitude == null || longitude == null) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
  }

  if (!triggerEvent || !VALID_TRIGGER_EVENTS.includes(triggerEvent)) {
    return res.status(400).json({
      error: `triggerEvent must be one of: ${VALID_TRIGGER_EVENTS.join(', ')}`,
    });
  }

  // Verify crew is assigned to this job
  const { data: job, error: jobError } = await supabase
    .from('mh_pwa_jobs')
    .select('id, ghl_job_id, status')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    logger.warn(`logLocation: job not found jobId=${jobId}`);
    return res.status(404).json({ error: 'Job not found' });
  }

  // Check crew assignment
  const { data: assignment, error: assignError } = await supabase
    .from('mh_pwa_job_crew_assignments')
    .select('id')
    .eq('job_id', jobId)
    .eq('crew_user_id', userId)
    .maybeSingle();

  if (assignError) {
    logger.error(`logLocation: assignment lookup error jobId=${jobId} userId=${userId}: ${assignError.message}`);
    return res.status(500).json({ error: 'Failed to verify crew assignment' });
  }

  if (!assignment) {
    logger.warn(`logLocation: crew not assigned jobId=${jobId} userId=${userId}`);
    return res.status(403).json({ error: 'You are not assigned to this job' });
  }

  // Insert location record
  const { data: location, error: insertError } = await supabase
    .from('mh_pwa_job_locations')
    .insert({
      job_id:        jobId,
      crew_user_id:  userId,
      latitude,
      longitude,
      accuracy:      accuracy ?? null,
      trigger_event: triggerEvent,
    })
    .select('id, latitude, longitude, trigger_event, timestamp')
    .single();

  if (insertError) {
    logger.error(`logLocation: insert failed jobId=${jobId}: ${insertError.message}`);
    return res.status(500).json({ error: 'Failed to log location' });
  }

  logger.info(`logLocation: saved jobId=${jobId} trigger=${triggerEvent} crew=${userId}`);

  // Fire-and-forget GHL push for key trigger events
  if (GHL_TRIGGER_EVENTS.includes(triggerEvent) && job.ghl_job_id && locationId) {
    ghlOutbound
      .pushLocationUpdate(job.ghl_job_id, { latitude, longitude, triggerEvent }, locationId)
      .catch((err) =>
        logger.error(`logLocation: GHL push failed jobId=${jobId}: ${err.message}`)
      );
  }

  return res.status(201).json({
    id:           location.id,
    latitude:     location.latitude,
    longitude:    location.longitude,
    triggerEvent: location.trigger_event,
    timestamp:    location.timestamp,
  });
}

// ---------------------------------------------------------------------------
// getLocations — GET /jobs/:jobId/locations
// ---------------------------------------------------------------------------
async function getLocations(req, res) {
  const { jobId } = req.params;
  const userId    = req.user.userId;
  const userRole  = req.user.role;

  // Allow access if admin/lead, or if the requesting user is assigned to the job
  const isAdminOrLead = userRole === 'admin' || userRole === 'lead';

  if (!isAdminOrLead) {
    const { data: assignment, error: assignError } = await supabase
      .from('mh_pwa_job_crew_assignments')
      .select('id')
      .eq('job_id', jobId)
      .eq('crew_user_id', userId)
      .maybeSingle();

    if (assignError) {
      logger.error(`getLocations: assignment lookup error jobId=${jobId}: ${assignError.message}`);
      return res.status(500).json({ error: 'Failed to verify crew assignment' });
    }

    if (!assignment) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const { data: locations, error } = await supabase
    .from('mh_pwa_job_locations')
    .select('id, latitude, longitude, accuracy, trigger_event, crew_user_id, timestamp')
    .eq('job_id', jobId)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error) {
    logger.error(`getLocations: query failed jobId=${jobId}: ${error.message}`);
    return res.status(500).json({ error: 'Failed to fetch locations' });
  }

  const mapped = (locations ?? []).map((loc) => ({
    id:           loc.id,
    latitude:     loc.latitude,
    longitude:    loc.longitude,
    accuracy:     loc.accuracy,
    triggerEvent: loc.trigger_event,
    crewId:       loc.crew_user_id,
    timestamp:    loc.timestamp,
  }));

  return res.status(200).json({ locations: mapped });
}

module.exports = { logLocation, getLocations };
