'use strict';

const supabase = require('../services/supabase');
const ghlOutbound = require('../services/ghlOutbound');
const logger          = require('../utils/logger');
const { logActivity } = require('../utils/logger');
const { notifyAdmins, getNotificationSettings } = require('../services/pushService');

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS = {
  assigned:    ['enroute',    'cancelled'],
  enroute:     ['arrived',    'cancelled'],
  arrived:     ['in_progress','cancelled'],
  in_progress: ['completed',  'cancelled'],
};

function isValidTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return Array.isArray(allowed) && allowed.includes(newStatus);
}

const STATUS_LABELS = {
  assigned:    'Assigned',
  enroute:     'En Route',
  arrived:     'Arrived',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

function formatStatusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

// ---------------------------------------------------------------------------
// getMyJobs
// GET /api/jobs
// Returns all jobs assigned to the authenticated crew member.
// Shows jobs from yesterday onwards, ordered by scheduled_date ASC.
// ---------------------------------------------------------------------------
async function getMyJobs(req, res) {
  const userId     = req.user.userId;
  const locationId = req.user.locationId;
  const tab        = req.query.tab === 'history' ? 'history' : 'upcoming';

  try {
    // Step 1: get job IDs assigned to this crew member
    const { data: assignments, error: assignError } = await supabase
      .from('mh_pwa_job_crew_assignments')
      .select('job_id')
      .eq('crew_user_id', userId);

    if (assignError) {
      logger.error(`getMyJobs assignment fetch error for user ${userId}: ${assignError.message}`);
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    const jobIds = (assignments ?? []).map((a) => a.job_id).filter(Boolean);
    if (jobIds.length === 0) return res.json({ jobs: [] });

    // Step 2: fetch jobs scoped to this tenant
    const jobsQuery = supabase
      .from('mh_pwa_jobs')
      .select('id, ghl_job_id, status, customer_name, pickup_address, dropoff_address, scheduled_date, notes, cancellation_reason, created_at, updated_at')
      .in('id', jobIds);

    if (locationId) jobsQuery.eq('location_id', locationId);

    if (tab === 'history') {
      jobsQuery
        .in('status', ['completed', 'cancelled'])
        .order('updated_at', { ascending: false })
        .limit(15);
    } else {
      jobsQuery
        .not('status', 'in', '("completed","cancelled")')
        .order('scheduled_date', { ascending: true });
    }

    const { data: allJobs, error: jobsError } = await jobsQuery;

    if (jobsError) {
      logger.error(`getMyJobs jobs fetch error for user ${userId}: ${jobsError.message}`);
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    const jobs = allJobs ?? [];

    return res.json({ jobs });
  } catch (err) {
    logger.error(`getMyJobs unexpected error: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// getJobById
// GET /api/jobs/:id
// Returns a single job, verifying the crew member is assigned to it.
// ---------------------------------------------------------------------------
async function getJobById(req, res) {
  const userId     = req.user.userId;
  const locationId = req.user.locationId;
  const { id }     = req.params;

  try {
    // Security check: confirm assignment before returning job data
    const { data: assignment, error: assignError } = await supabase
      .from('mh_pwa_job_crew_assignments')
      .select('job_id')
      .eq('job_id', id)
      .eq('crew_user_id', userId)
      .maybeSingle();

    if (assignError) {
      logger.error(`getJobById assignment check error: ${assignError.message}`);
      return res.status(500).json({ error: 'Failed to verify job assignment' });
    }

    if (!assignment) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    const jobQuery = supabase
      .from('mh_pwa_jobs')
      .select('*')
      .eq('id', id);

    if (locationId) jobQuery.eq('location_id', locationId);

    const { data: job, error: jobError } = await jobQuery.single();

    if (jobError) {
      logger.error(`getJobById fetch error for job ${id}: ${jobError.message}`);
      return res.status(500).json({ error: 'Failed to fetch job details' });
    }

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    logActivity('job', 'job_viewed', { userId, locationId, jobId: id });
    return res.json({ job });
  } catch (err) {
    logger.error(`getJobById unexpected error: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// updateJobStatus
// PATCH /api/jobs/:id/status
// Body: { status, notes?, cancellationReason? }
// Validates transition, updates DB, fires GHL outbound (fire-and-forget).
// ---------------------------------------------------------------------------
async function updateJobStatus(req, res) {
  const userId     = req.user.userId;
  const locationId = req.user.locationId;
  const { id }     = req.params;
  const { status: newStatus, notes, cancellationReason } = req.body;

  if (!newStatus) {
    return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'status', message: 'status is required' }] });
  }

  try {
    // Security check: confirm assignment
    const { data: assignment, error: assignError } = await supabase
      .from('mh_pwa_job_crew_assignments')
      .select('job_id')
      .eq('job_id', id)
      .eq('crew_user_id', userId)
      .maybeSingle();

    if (assignError) {
      logger.error(`updateJobStatus assignment check error: ${assignError.message}`);
      return res.status(500).json({ error: 'Failed to verify job assignment' });
    }

    if (!assignment) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    // Fetch current job to validate the transition (also enforces location scope)
    const currentJobQuery = supabase
      .from('mh_pwa_jobs')
      .select('id, status, ghl_job_id, scheduled_date, updated_at')
      .eq('id', id);

    if (locationId) currentJobQuery.eq('location_id', locationId);

    const { data: currentJob, error: fetchError } = await currentJobQuery.single();

    if (fetchError || !currentJob) {
      logger.error(`updateJobStatus fetch current job error: ${fetchError?.message}`);
      return res.status(404).json({ error: 'Job not found' });
    }

    // Validate transition
    if (!isValidTransition(currentJob.status, newStatus)) {
      logActivity('job', 'status_update_invalid', { userId, locationId, jobId: id, from: currentJob.status, to: newStatus }, 'warn');
      return res.status(422).json({
        error: 'Invalid status transition',
        message: `Cannot transition from '${currentJob.status}' to '${newStatus}'`,
      });
    }

    // Build update payload
    const updatePayload = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (notes !== undefined)              updatePayload.notes = notes;
    if (cancellationReason !== undefined) updatePayload.cancellation_reason = cancellationReason;

    // Persist to DB
    const { data: updatedJob, error: updateError } = await supabase
      .from('mh_pwa_jobs')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      logger.error(`updateJobStatus DB update error for job ${id}: ${updateError.message}`);
      return res.status(500).json({ error: 'Failed to update job status' });
    }

    logger.info(`Job ${id} status updated: ${currentJob.status} → ${newStatus} by user ${userId}`);
    logActivity('job', 'status_update', { userId, locationId, jobId: id, ghlJobId: currentJob.ghl_job_id, from: currentJob.status, to: newStatus, notes, cancellationReason });

    // ---- Push notification to admins (fire-and-forget) ----
    if (locationId) {
      (async () => {
        try {
          const settings = await getNotificationSettings(locationId);
          if (settings.adminStatusChanged) {
            const { data: actor } = await supabase
              .from('mh_pwa_crew_users')
              .select('full_name')
              .eq('id', userId)
              .maybeSingle();
            const crewName = actor?.full_name ?? 'A crew member';
            await notifyAdmins(locationId, {
              title: 'Job Status Update',
              body:  `${crewName} changed status to ${formatStatusLabel(newStatus)}${updatedJob.customer_name ? ` — ${updatedJob.customer_name}` : ''}`,
              url:   `/admin/jobs`,
              tag:   `status-${id}`,
            });
          }
        } catch (err) {
          logger.error(`Status change push notification failed: ${err.message}`);
        }
      })();
    }

    // ---- GHL outbound calls (fire-and-forget) ----
    const ghlJobId = currentJob.ghl_job_id;

    if (ghlJobId && locationId) {
      if (newStatus === 'completed') {
        let totalMinutes = null;
        if (currentJob.scheduled_date) {
          const startMs = new Date(currentJob.scheduled_date).getTime();
          const endMs   = Date.now();
          totalMinutes  = Math.round((endMs - startMs) / 60000);
        }
        ghlOutbound
          .pushCompletion(ghlJobId, { totalMinutes, notes, completedAt: new Date().toISOString() }, locationId)
          .catch((err) => logger.error(`GHL pushCompletion failed silently: ${err.message}`));
      }

      if (newStatus === 'cancelled') {
        ghlOutbound
          .pushCancellation(ghlJobId, cancellationReason, locationId)
          .catch((err) => logger.error(`GHL pushCancellation failed silently: ${err.message}`));
      }
    } else {
      logger.warn(`Job ${id} skipping GHL outbound — ghl_job_id=${ghlJobId} locationId=${locationId}`);
    }

    // ---- Pipeline stage sync (fire-and-forget) ----
    if (ghlJobId && locationId) {
      (async () => {
        try {
          const { data: tenant } = await supabase
            .from('mh_pwa_tenants')
            .select('pipeline_id')
            .eq('location_id', locationId)
            .maybeSingle();

          if (tenant?.pipeline_id) {
            const { data: stageRow } = await supabase
              .from('mh_pwa_pipeline_stages')
              .select('stage_id, pipeline_id')
              .eq('location_id', locationId)
              .eq('pipeline_id', tenant.pipeline_id)
              .eq('job_status', newStatus)
              .maybeSingle();

            if (stageRow) {
              ghlOutbound
                .pushStageUpdate(ghlJobId, stageRow.pipeline_id, stageRow.stage_id, locationId)
                .catch((err) => logger.error(`GHL pushStageUpdate failed silently: ${err.message}`));
            }
          }

          // Always update the job_status custom field
          ghlOutbound
            .pushCustomFieldUpdate(ghlJobId, 'opportunity.job_status', formatStatusLabel(newStatus), locationId)
            .catch((err) => logger.error(`GHL pushCustomFieldUpdate failed silently: ${err.message}`));
        } catch (err) {
          logger.error(`Stage sync lookup failed silently: ${err.message}`);
        }
      })();
    }

    return res.json({ job: updatedJob });
  } catch (err) {
    logger.error(`updateJobStatus unexpected error: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getMyJobs, getJobById, updateJobStatus };
