const supabase = require('../services/supabase');
const logger = require('../utils/logger');

// Verify the crew member is assigned to this job.
// Returns true if assigned, sends 403/404 and returns false if not.
async function verifyAssignment(res, jobId, crewUserId) {
  const { data, error } = await supabase
    .from('mh_pwa_job_crew_assignments')
    .select('job_id')
    .eq('job_id', jobId)
    .eq('crew_user_id', crewUserId)
    .maybeSingle();

  if (error) {
    logger.error('timesheetController: assignment check error', { error, jobId, crewUserId });
    res.status(500).json({ error: 'Failed to verify job assignment' });
    return false;
  }
  if (!data) {
    res.status(403).json({ error: 'You are not assigned to this job' });
    return false;
  }
  return true;
}

/**
 * POST /jobs/:jobId/timesheets/clock-in
 * Clock the authenticated crew member in for a job.
 * Returns 409 if they are already clocked in (active timesheet exists).
 */
async function clockIn(req, res) {
  const { jobId } = req.params;
  const crewUserId = req.user.userId;

  try {
    if (!await verifyAssignment(res, jobId, crewUserId)) return;

    // Check for an existing active timesheet (clock_in set, clock_out null)
    const { data: existing, error: checkError } = await supabase
      .from('mh_pwa_timesheets')
      .select('id')
      .eq('job_id', jobId)
      .eq('crew_user_id', crewUserId)
      .is('clock_out', null)
      .not('clock_in', 'is', null)
      .maybeSingle();

    if (checkError) {
      logger.error('timesheetController.clockIn check error', { error: checkError, jobId, crewUserId });
      return res.status(500).json({ error: 'Failed to check existing timesheet' });
    }

    if (existing) {
      return res.status(409).json({ error: 'Already clocked in' });
    }

    // Insert new timesheet row
    const { data: timesheet, error: insertError } = await supabase
      .from('mh_pwa_timesheets')
      .insert({
        job_id: jobId,
        crew_user_id: crewUserId,
        clock_in: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logger.error('timesheetController.clockIn insert error', { error: insertError, jobId, crewUserId });
      return res.status(500).json({ error: 'Failed to clock in' });
    }

    logger.info('Crew clocked in', { timesheetId: timesheet.id, jobId, crewUserId });
    return res.status(201).json({ timesheet });
  } catch (err) {
    logger.error('timesheetController.clockIn unexpected error', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /jobs/:jobId/timesheets/clock-out
 * Clock the authenticated crew member out.
 * Accepts optional breakMinutes in the request body.
 * total_minutes is computed by a Postgres generated column.
 */
async function clockOut(req, res) {
  const { jobId } = req.params;
  const crewUserId = req.user.userId;
  const { breakMinutes } = req.body;

  try {
    if (!await verifyAssignment(res, jobId, crewUserId)) return;

    // Find the active timesheet
    const { data: active, error: findError } = await supabase
      .from('mh_pwa_timesheets')
      .select('id, break_minutes')
      .eq('job_id', jobId)
      .eq('crew_user_id', crewUserId)
      .is('clock_out', null)
      .not('clock_in', 'is', null)
      .maybeSingle();

    if (findError) {
      logger.error('timesheetController.clockOut find error', { error: findError, jobId, crewUserId });
      return res.status(500).json({ error: 'Failed to find active timesheet' });
    }

    if (!active) {
      return res.status(404).json({ error: 'No active timesheet found' });
    }

    // Build the update payload
    const updatePayload = {
      clock_out: new Date().toISOString(),
    };

    // If breakMinutes were supplied on clock-out (end of last break), accumulate them
    if (breakMinutes != null && !isNaN(Number(breakMinutes))) {
      const existingBreak = active.break_minutes ?? 0;
      updatePayload.break_minutes = existingBreak + Number(breakMinutes);
    }

    const { data: timesheet, error: updateError } = await supabase
      .from('mh_pwa_timesheets')
      .update(updatePayload)
      .eq('id', active.id)
      .select()
      .single();

    if (updateError) {
      logger.error('timesheetController.clockOut update error', { error: updateError, timesheetId: active.id });
      return res.status(500).json({ error: 'Failed to clock out' });
    }

    logger.info('Crew clocked out', { timesheetId: timesheet.id, jobId, crewUserId });
    return res.status(200).json({ timesheet });
  } catch (err) {
    logger.error('timesheetController.clockOut unexpected error', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /jobs/:jobId/timesheets/break-end
 * Accumulate break minutes on the active timesheet.
 * Expects { breakMinutes: number } in the request body.
 */
async function endBreak(req, res) {
  const { jobId } = req.params;
  const crewUserId = req.user.userId;
  const { breakMinutes } = req.body;

  if (breakMinutes == null || isNaN(Number(breakMinutes))) {
    return res.status(400).json({ error: 'breakMinutes is required and must be a number' });
  }

  try {
    if (!await verifyAssignment(res, jobId, crewUserId)) return;

    // Find the active timesheet
    const { data: active, error: findError } = await supabase
      .from('mh_pwa_timesheets')
      .select('id, break_minutes')
      .eq('job_id', jobId)
      .eq('crew_user_id', crewUserId)
      .is('clock_out', null)
      .not('clock_in', 'is', null)
      .maybeSingle();

    if (findError) {
      logger.error('timesheetController.endBreak find error', { error: findError, jobId, crewUserId });
      return res.status(500).json({ error: 'Failed to find active timesheet' });
    }

    if (!active) {
      return res.status(404).json({ error: 'No active timesheet found' });
    }

    const existingBreak = active.break_minutes ?? 0;
    const newBreakTotal = existingBreak + Number(breakMinutes);

    const { data: timesheet, error: updateError } = await supabase
      .from('mh_pwa_timesheets')
      .update({ break_minutes: newBreakTotal })
      .eq('id', active.id)
      .select()
      .single();

    if (updateError) {
      logger.error('timesheetController.endBreak update error', { error: updateError, timesheetId: active.id });
      return res.status(500).json({ error: 'Failed to update break minutes' });
    }

    logger.info('Break ended', { timesheetId: timesheet.id, breakMinutes, newBreakTotal, jobId, crewUserId });
    return res.status(200).json({ timesheet });
  } catch (err) {
    logger.error('timesheetController.endBreak unexpected error', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /jobs/:jobId/timesheets
 * Return all timesheet records for this crew member and job.
 */
async function getTimesheets(req, res) {
  const { jobId } = req.params;
  const crewUserId = req.user.userId;

  try {
    const { data: timesheets, error } = await supabase
      .from('mh_pwa_timesheets')
      .select('*')
      .eq('job_id', jobId)
      .eq('crew_user_id', crewUserId)
      .order('clock_in', { ascending: true });

    if (error) {
      logger.error('timesheetController.getTimesheets error', { error, jobId, crewUserId });
      return res.status(500).json({ error: 'Failed to fetch timesheets' });
    }

    return res.status(200).json({ timesheets });
  } catch (err) {
    logger.error('timesheetController.getTimesheets unexpected error', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { clockIn, clockOut, endBreak, getTimesheets };
