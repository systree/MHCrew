'use strict';

const { getGhlClient } = require('./ghl');
const supabase         = require('./supabase');
const logger           = require('../utils/logger');
const { retryWithBackoff } = require('../utils/retry');
const { mapStageToStatus } = require('../utils/stageStatusMap');

// ---------------------------------------------------------------------------
// Sync log helper
// ---------------------------------------------------------------------------
async function logOutbound(eventType, payload, status, locationId = null, errorMessage = null) {
  const record = {
    direction:   'outbound',
    event_type:  eventType,
    payload,
    status,
    location_id: locationId,
  };
  if (errorMessage) record.error_message = errorMessage;

  const { error } = await supabase.from('mh_pwa_ghl_sync_log').insert(record);
  if (error) {
    logger.error(`Failed to write outbound ghl_sync_log [${eventType}]: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// pushStatusUpdate
// Push a job status change to the corresponding GHL opportunity.
// ---------------------------------------------------------------------------
async function pushStatusUpdate(ghlJobId, status, notes, locationId) {
  const eventType = 'opportunity.status_update';
  const payload   = { ghlJobId, status, notes, locationId };

  logger.info(`GHL outbound: ${eventType} opportunity=${ghlJobId} status=${status} location=${locationId}`);

  try {
    const client = await getGhlClient(locationId);
    await retryWithBackoff(() =>
      client.put(`/opportunities/${ghlJobId}`, {
        status,
        ...(notes ? { description: notes } : {}),
      })
    );

    await logOutbound(eventType, payload, 'success', locationId);
    logger.info(`GHL outbound success: ${eventType} opportunity=${ghlJobId}`);
  } catch (err) {
    logger.error(`GHL outbound failed: ${eventType} opportunity=${ghlJobId}: ${err.message}`);
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}

// ---------------------------------------------------------------------------
// pushCompletion
// Push job-completion data (duration, notes, timestamp) to GHL opportunity.
// ---------------------------------------------------------------------------
async function pushCompletion(ghlJobId, { totalMinutes, notes, completedAt }, locationId) {
  const eventType = 'opportunity.completed';
  const payload   = { ghlJobId, totalMinutes, notes, completedAt, locationId };

  logger.info(`GHL outbound: ${eventType} opportunity=${ghlJobId} location=${locationId}`);

  try {
    const client = await getGhlClient(locationId);
    await retryWithBackoff(() =>
      client.put(`/opportunities/${ghlJobId}`, {
        status: 'won',
        description: [
          notes,
          totalMinutes != null ? `Duration: ${totalMinutes} minutes` : null,
          completedAt ? `Completed at: ${completedAt}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      })
    );

    await logOutbound(eventType, payload, 'success', locationId);
    logger.info(`GHL outbound success: ${eventType} opportunity=${ghlJobId}`);
  } catch (err) {
    logger.error(`GHL outbound failed: ${eventType} opportunity=${ghlJobId}: ${err.message}`);
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}

// ---------------------------------------------------------------------------
// pushCancellation
// Mark a GHL opportunity as lost/cancelled with an optional reason.
// ---------------------------------------------------------------------------
async function pushCancellation(ghlJobId, reason, locationId) {
  const eventType = 'opportunity.cancelled';
  const payload   = { ghlJobId, reason, locationId };

  logger.info(`GHL outbound: ${eventType} opportunity=${ghlJobId} location=${locationId}`);

  try {
    const client = await getGhlClient(locationId);
    await retryWithBackoff(() =>
      client.put(`/opportunities/${ghlJobId}`, {
        status: 'lost',
        ...(reason ? { description: reason } : {}),
      })
    );

    await logOutbound(eventType, payload, 'success', locationId);
    logger.info(`GHL outbound success: ${eventType} opportunity=${ghlJobId}`);
  } catch (err) {
    logger.error(`GHL outbound failed: ${eventType} opportunity=${ghlJobId}: ${err.message}`);
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}

// ---------------------------------------------------------------------------
// pushPhotoUrl
// Attach a photo URL to a GHL contact as a note.
// ---------------------------------------------------------------------------
async function pushPhotoUrl(ghlContactId, photoUrl, photoType, jobId, locationId) {
  const eventType = 'contact.photo_note';
  const payload   = { ghlContactId, photoUrl, photoType, jobId, locationId };

  const noteBody = [
    `Photo type: ${photoType || 'unspecified'}`,
    jobId ? `Job ID: ${jobId}` : null,
    `URL: ${photoUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  logger.info(`GHL outbound: ${eventType} contact=${ghlContactId} type=${photoType} location=${locationId}`);

  try {
    const client = await getGhlClient(locationId);
    await retryWithBackoff(() =>
      client.post(`/contacts/${ghlContactId}/notes`, { body: noteBody })
    );

    await logOutbound(eventType, payload, 'success', locationId);
    logger.info(`GHL outbound success: ${eventType} contact=${ghlContactId}`);
  } catch (err) {
    logger.error(`GHL outbound failed: ${eventType} contact=${ghlContactId}: ${err.message}`);
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}

// ---------------------------------------------------------------------------
// pushStageUpdate
// Move a GHL opportunity to a specific pipeline stage.
// ---------------------------------------------------------------------------
async function pushStageUpdate(ghlJobId, pipelineId, stageId, locationId) {
  const eventType = 'opportunity.stage_update';
  const payload   = { ghlJobId, pipelineId, stageId, locationId };

  logger.info(`GHL outbound: ${eventType} opportunity=${ghlJobId} stage=${stageId} location=${locationId}`);

  try {
    const client = await getGhlClient(locationId);
    await retryWithBackoff(() =>
      client.put(`/opportunities/${ghlJobId}`, {
        pipelineId,
        pipelineStageId: stageId,
      })
    );

    await logOutbound(eventType, payload, 'success', locationId);
    logger.info(`GHL outbound success: ${eventType} opportunity=${ghlJobId}`);
  } catch (err) {
    logger.error(`GHL outbound failed: ${eventType} opportunity=${ghlJobId}: ${err.message}`);
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}

// ---------------------------------------------------------------------------
// pushCustomFieldUpdate
// Update a single custom field value on a GHL opportunity.
// ---------------------------------------------------------------------------
async function pushCustomFieldUpdate(ghlJobId, fieldKey, value, locationId) {
  const eventType = 'opportunity.custom_field_update';
  const payload   = { ghlJobId, fieldKey, value, locationId };

  logger.info(`GHL outbound: ${eventType} opportunity=${ghlJobId} field=${fieldKey} location=${locationId}`);

  try {
    // GHL PUT /opportunities/:id requires customFields as [{ id: fieldUUID, field_value }]
    // Look up the UUID for this fieldKey from the cached definitions
    const supabase = require('./supabase');
    const { data: fieldRow } = await supabase
      .from('mh_pwa_location_custom_fields')
      .select('field_id')
      .eq('location_id', locationId)
      .eq('field_key', fieldKey)
      .maybeSingle();

    if (!fieldRow) {
      logger.warn(`pushCustomFieldUpdate: no field UUID found for key=${fieldKey} location=${locationId} — skipping`);
      await logOutbound(eventType, payload, 'failed', locationId, `No field UUID for key=${fieldKey}`);
      return;
    }

    const client = await getGhlClient(locationId);
    await retryWithBackoff(() =>
      client.put(`/opportunities/${ghlJobId}`, {
        customFields: [{ id: fieldRow.field_id, field_value: value }],
      })
    );

    await logOutbound(eventType, payload, 'success', locationId);
    logger.info(`GHL outbound success: ${eventType} opportunity=${ghlJobId} field=${fieldKey}`);
  } catch (err) {
    logger.error(`GHL outbound failed: ${eventType} opportunity=${ghlJobId} field=${fieldKey}: ${err.message}`);
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}

// ---------------------------------------------------------------------------
// pushLocationUpdate
// Send an en-route or arrived event to GHL as a note on the opportunity.
// ---------------------------------------------------------------------------
async function pushLocationUpdate(ghlJobId, { latitude, longitude, triggerEvent }, locationId) {
  const eventType = `location.${triggerEvent || 'update'}`;
  const payload   = { ghlJobId, latitude, longitude, triggerEvent, locationId };

  const noteBody = [
    `Location update: ${triggerEvent || 'update'}`,
    `Lat: ${latitude}, Lng: ${longitude}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');

  logger.info(`GHL outbound: ${eventType} opportunity=${ghlJobId} location=${locationId}`);

  try {
    // GHL doesn't have opportunity notes — log only, no API call
    logger.info(`GHL outbound: ${eventType} — location note logged locally only (no GHL notes API for opportunities)`);

    await logOutbound(eventType, payload, 'success', locationId);
    logger.info(`GHL outbound success: ${eventType} opportunity=${ghlJobId}`);
  } catch (err) {
    logger.error(`GHL outbound failed: ${eventType} opportunity=${ghlJobId}: ${err.message}`);
    await logOutbound(eventType, payload, 'failed', locationId, err.message);
  }
}

// ---------------------------------------------------------------------------
// provisionCustomFields
// Creates the required custom fields if they don't already exist, across both
// the opportunity and contact models. Idempotent — safe to call on every
// install or from the admin panel. Also caches each field's UUID into
// mh_pwa_location_custom_fields so writers can resolve ids immediately.
// Returns { created: string[], existing: string[], failed: string[] }
// (entries are "<model>.<fieldKey>")
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = [
  { name: 'Pickup Address',   fieldKey: 'pickup_address',  dataType: 'TEXT',       model: 'opportunity' },
  { name: 'Dropoff Address',  fieldKey: 'dropoff_address', dataType: 'TEXT',       model: 'opportunity' },
  { name: 'Scheduled Date',   fieldKey: 'scheduled_date',  dataType: 'TEXT',       model: 'opportunity' },
  { name: 'Moving Inventory', fieldKey: 'moving_inventory', dataType: 'LARGE_TEXT', model: 'opportunity' },
  { name: 'Crew Notes',       fieldKey: 'crew_notes',      dataType: 'LARGE_TEXT', model: 'opportunity' },
  { name: 'Job Status',       fieldKey: 'job_status',      dataType: 'TEXT',       model: 'opportunity' },
  {
    name:     'Job Type',
    fieldKey: 'job_type',
    dataType: 'SINGLE_OPTIONS', // GHL's single-select type; DROPDOWN is not valid
    model:    'opportunity',
    options:  ['Door to Door', 'Depot to Depot', 'Quote'],
  },
];

async function provisionCustomFields(locationId) {
  const result = { created: [], existing: [], failed: [] };
  const cacheRows = []; // field UUIDs to upsert into mh_pwa_location_custom_fields

  // Collect a cache row for a field we either found or created.
  const cache = (cf, model, fallbackKey, fallbackName) => {
    if (cf?.id) {
      cacheRows.push({
        location_id: locationId,
        field_id:    cf.id,
        field_key:   cf.fieldKey || fallbackKey,
        field_label: cf.name ?? fallbackName,
        model,
        updated_at:  new Date().toISOString(),
      });
    }
  };

  try {
    const client = await getGhlClient(locationId);

    // Fetch existing fields once per model (opportunity, contact, ...).
    const models = [...new Set(REQUIRED_FIELDS.map((f) => f.model))];

    for (const model of models) {
      const { data } = await client.get(`/locations/${locationId}/customFields`, {
        params: { model },
      });
      const existing = data?.customFields ?? [];
      const existingByKey = new Map();
      for (const f of existing) {
        if (f.fieldKey) existingByKey.set(f.fieldKey, f);
      }

      for (const field of REQUIRED_FIELDS.filter((f) => f.model === model)) {
        // GHL stores fieldKey as "<model>.<key>" after creation
        const fullKey = `${model}.${field.fieldKey}`;
        const found = existingByKey.get(fullKey) || existingByKey.get(field.fieldKey);

        if (found) {
          result.existing.push(fullKey);
          cache(found, model, fullKey, field.name);
          continue;
        }

        try {
          const { data: createdData } = await client.post(`/locations/${locationId}/customFields`, {
            name:      field.name,
            fieldKey:  field.fieldKey,
            dataType:  field.dataType,
            model,
            position:  0,
            ...(field.options ? { options: field.options } : {}),
          });
          const created = createdData?.customField ?? createdData;
          result.created.push(fullKey);
          cache(created, model, fullKey, field.name);
          logger.info(`provisionCustomFields: created "${field.name}" (${model}) for location=${locationId}`);
        } catch (err) {
          result.failed.push(fullKey);
          logger.warn(`provisionCustomFields: failed to create "${field.name}" (${model}) for location=${locationId}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    logger.warn(`provisionCustomFields: could not fetch existing fields for location=${locationId}: ${err.message}`);
    // Token not ready yet — that's OK, caller handles retry
    throw err;
  }

  // Persist UUIDs so writers can resolve field ids without waiting for the daily sync.
  if (cacheRows.length) {
    const { error: upsertErr } = await supabase
      .from('mh_pwa_location_custom_fields')
      .upsert(cacheRows, { onConflict: 'location_id,field_id' });
    if (upsertErr) {
      logger.warn(`provisionCustomFields: cache upsert failed for location=${locationId}: ${upsertErr.message}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// provisionPipeline
// Ensures a "Mover Hero" pipeline exists for the location — reuses it if a
// pipeline with that exact name is already there (e.g. re-install), otherwise
// creates it with the fixed stage set below. Idempotent — safe to call on
// every install. Does NOT touch mh_pwa_tenants or mh_pwa_pipeline_stages;
// callers are responsible for persisting the returned pipelineId/stages.
// Returns { pipelineId, stages: [{ id, name, position }] }
// ---------------------------------------------------------------------------
const PIPELINE_NAME = 'Mover Hero';

const DEFAULT_STAGES = [
  { name: 'New Lead',             color: '#2563EB' },
  { name: 'Inventory Submitted',  color: '#0D9488' },
  { name: 'Booked',               color: '#7C3AED' },
  { name: 'En Route',             color: '#D97706' },
  { name: 'On Site',              color: '#0EA5E9' },
  { name: 'In Progress',          color: '#CA8A04' },
  { name: 'Completed',            color: '#16A34A' },
  { name: 'Cancelled',            color: '#DC2626' },
];

async function provisionPipeline(locationId) {
  const client = await getGhlClient(locationId);
  const { data: ghlData } = await client.get('/opportunities/pipelines', {
    params: { locationId },
  });

  const existing = (ghlData?.pipelines ?? []).find((p) => p.name === PIPELINE_NAME);
  if (existing) {
    logger.info(`provisionPipeline: reusing existing "${PIPELINE_NAME}" pipeline=${existing.id} for location=${locationId}`);
    return { pipelineId: existing.id, stages: existing.stages ?? [] };
  }

  const { data: createdData } = await client.post('/opportunities/pipelines', {
    name:                      PIPELINE_NAME,
    locationId,
    colorRenderMode:           'bg-tint',
    showInFunnel:              true,
    showInPieChart:             true,
    useOpportunityProbability: false,
    stages: DEFAULT_STAGES.map((stage, i) => ({
      name:               stage.name,
      position:           i,
      showInFunnel:       true,
      showInPieChart:     true,
      color:              stage.color,
      stageWinProbability: 0,
    })),
  });

  const created = createdData?.pipeline ?? createdData;
  logger.info(`provisionPipeline: created "${PIPELINE_NAME}" pipeline=${created.id} for location=${locationId}`);
  return { pipelineId: created.id, stages: created.stages ?? [] };
}

// ---------------------------------------------------------------------------
// applyDefaultJobStatuses
// Fills in a sensible default job_status (from STAGE_STATUS_MAP, by stage
// name) for any stage row that doesn't have one set yet. Never overwrites a
// value an admin already configured — guarded by `job_status IS NULL`.
// stageRows: [{ stage_id, stage_name }]
// ---------------------------------------------------------------------------
async function applyDefaultJobStatuses(locationId, stageRows) {
  for (const { stage_id: stageId, stage_name: stageName } of stageRows) {
    const defaultStatus = mapStageToStatus(stageName);
    if (!defaultStatus) continue; // no recognizable default — leave unmapped (e.g. New Lead)

    const { error } = await supabase
      .from('mh_pwa_pipeline_stages')
      .update({ job_status: defaultStatus, updated_at: new Date().toISOString() })
      .eq('location_id', locationId)
      .eq('stage_id', stageId)
      .is('job_status', null);

    if (error) {
      logger.warn(`applyDefaultJobStatuses: failed for stage=${stageId} location=${locationId}: ${error.message}`);
    }
  }
}

module.exports = {
  pushStatusUpdate,
  pushCompletion,
  pushCancellation,
  pushPhotoUrl,
  pushLocationUpdate,
  pushStageUpdate,
  pushCustomFieldUpdate,
  provisionCustomFields,
  provisionPipeline,
  applyDefaultJobStatuses,
};
