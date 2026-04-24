'use strict';

const { getGhlClient } = require('./ghl');
const supabase         = require('./supabase');
const logger           = require('../utils/logger');
const { retryWithBackoff } = require('../utils/retry');

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
// Creates the 6 required opportunity custom fields if they don't already exist.
// Idempotent — safe to call on every install or from the admin panel.
// Returns { created: string[], existing: string[], failed: string[] }
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = [
  { name: 'Pickup Address',   fieldKey: 'pickup_address',  dataType: 'TEXT'       },
  { name: 'Dropoff Address',  fieldKey: 'dropoff_address', dataType: 'TEXT'       },
  { name: 'Scheduled Date',   fieldKey: 'scheduled_date',  dataType: 'TEXT'       },
  { name: 'Item Summary',     fieldKey: 'item_summary',    dataType: 'LARGE_TEXT' },
  { name: 'Crew Notes',       fieldKey: 'crew_notes',      dataType: 'LARGE_TEXT' },
  { name: 'Job Status',       fieldKey: 'job_status',      dataType: 'TEXT'       },
];

async function provisionCustomFields(locationId) {
  const result = { created: [], existing: [], failed: [] };

  try {
    const client = await getGhlClient(locationId);

    // Fetch existing opportunity custom fields
    const { data } = await client.get(`/locations/${locationId}/customFields`, {
      params: { model: 'opportunity' },
    });
    const existing = data?.customFields ?? [];
    const existingKeys = new Set(existing.map((f) => f.fieldKey));

    for (const field of REQUIRED_FIELDS) {
      // GHL stores fieldKey as "opportunity.<key>" after creation
      const fullKey = `opportunity.${field.fieldKey}`;
      if (existingKeys.has(fullKey) || existingKeys.has(field.fieldKey)) {
        result.existing.push(field.fieldKey);
        continue;
      }

      try {
        await client.post(`/locations/${locationId}/customFields`, {
          name:      field.name,
          fieldKey:  field.fieldKey,
          dataType:  field.dataType,
          model:     'opportunity',
          position:  0,
        });
        result.created.push(field.fieldKey);
        logger.info(`provisionCustomFields: created "${field.name}" for location=${locationId}`);
      } catch (err) {
        result.failed.push(field.fieldKey);
        logger.warn(`provisionCustomFields: failed to create "${field.name}" for location=${locationId}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.warn(`provisionCustomFields: could not fetch existing fields for location=${locationId}: ${err.message}`);
    // Token not ready yet — that's OK, caller handles retry
    throw err;
  }

  return result;
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
};
