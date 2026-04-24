'use strict';

const crypto   = require('crypto');
const supabase = require('../services/supabase');
const { getGhlClient }                    = require('../services/ghl');
const logger                              = require('../utils/logger');
const { logActivity }                     = require('../utils/logger');
const { STAGE_STATUS_MAP, mapStageToStatus } = require('../utils/stageStatusMap');
const { parseScheduledDate } = require('../utils/dateUtils');
const { notifyUser, getNotificationSettings } = require('../services/pushService');
const { provisionCustomFields } = require('../services/ghlOutbound');

// ---------------------------------------------------------------------------
// Signature verification — Ed25519 (X-GHL-Signature)
// GHL signs the raw request body with an Ed25519 private key.
// Set GHL_WEBHOOK_PUBLIC_KEY in .env to the PEM public key from your GHL app settings.
// In .env, replace newlines with \n and wrap in double quotes:
//   GHL_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMCow...\n-----END PUBLIC KEY-----"
// ---------------------------------------------------------------------------
function verifySignature(rawBody, receivedSig) {
  const publicKeyPem = process.env.GHL_WEBHOOK_PUBLIC_KEY;

  if (!publicKeyPem) {
    logger.warn('GHL_WEBHOOK_PUBLIC_KEY not set — skipping signature verification');
    return true;
  }

  if (!receivedSig || receivedSig === 'N/A') {
    logger.warn('No valid X-GHL-Signature header present');
    return false;
  }

  try {
    // rawBody is already a Buffer (captured by captureRawBody middleware)
    const payloadBuffer   = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const signatureBuffer = Buffer.from(receivedSig, 'base64');
    const ok = crypto.verify(null, payloadBuffer, publicKeyPem, signatureBuffer);
    if (!ok) logger.warn('GHL signature verify returned false');
    return ok;
  } catch (err) {
    logger.error(`Signature verification error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tenant validation gate
// Every event except INSTALL must come from a known active tenant.
// Returns true if the locationId is valid, false otherwise.
// ---------------------------------------------------------------------------
const TENANT_BYPASS_EVENTS = new Set(['INSTALL', 'AppInstall']);

async function isTenantActive(locationId, eventType) {
  if (TENANT_BYPASS_EVENTS.has(eventType)) return true; // install registers the tenant
  if (!locationId) return false;

  const { data, error } = await supabase
    .from('mh_pwa_tenants')
    .select('is_active')
    .eq('location_id', locationId)
    .maybeSingle();

  if (error) {
    logger.error(`Tenant check DB error for location=${locationId}: ${error.message}`);
    return false;
  }

  if (!data) {
    logger.warn(`Tenant gate: unknown location=${locationId} — app not installed or INSTALL not processed`);
    return false;
  }

  if (!data.is_active) {
    logger.warn(`Tenant gate: location=${locationId} is inactive (uninstalled)`);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Sync log helpers
// ---------------------------------------------------------------------------
async function createSyncLog(eventType, payload, locationId = null) {
  const { data, error } = await supabase
    .from('mh_pwa_ghl_sync_log')
    .insert({ direction: 'inbound', event_type: eventType, payload, status: 'pending', location_id: locationId })
    .select('id')
    .single();

  if (error) {
    logger.error(`Failed to create ghl_sync_log entry: ${error.message}`);
    return null;
  }
  return data.id;
}

async function updateSyncLog(logId, status, errorMessage = null) {
  if (!logId) return;
  const update = { status };
  if (errorMessage) update.error_message = errorMessage;

  const { error } = await supabase
    .from('mh_pwa_ghl_sync_log')
    .update(update)
    .eq('id', logId);

  if (error) {
    logger.error(`Failed to update ghl_sync_log id=${logId}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// GHL API — fetch full opportunity record
// Webhooks only send flat scalar fields; custom fields and stage.name
// require a follow-up API call.
// ---------------------------------------------------------------------------
async function fetchFullOpportunity(ghlJobId, locationId) {
  try {
    const client = await getGhlClient(locationId);
    const { data } = await client.get(`/opportunities/${ghlJobId}`);
    return data?.opportunity ?? data ?? null;
  } catch (err) {
    logger.error(`fetchFullOpportunity failed for ${ghlJobId} location=${locationId}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Custom-field definitions — DB-backed per-location store
//
// GHL returns customFields as [{ id, fieldValue }] on opportunity fetches.
// To resolve field UUIDs → fieldKey names we fetch the location's field
// definitions from the GHL API and persist them in mh_pwa_location_custom_fields.
//
// Strategy:
//   1. Read from DB (fast, survives restarts, works across multiple instances).
//   2. If DB is empty for this location, fetch from GHL API and persist.
//   3. Refresh from GHL API if the DB row is older than FIELD_DEF_REFRESH_DAYS.
// ---------------------------------------------------------------------------
const FIELD_DEF_REFRESH_DAYS = 1; // re-sync field defs daily

async function getFieldKeyMap(locationId) {
  // --- Read from DB ---
  const { data: rows, error } = await supabase
    .from('mh_pwa_location_custom_fields')
    .select('field_id, field_key, updated_at')
    .eq('location_id', locationId);

  if (error) {
    logger.warn(`getFieldKeyMap: DB read error for location=${locationId}: ${error.message}`);
  }

  const now = Date.now();
  const staleThreshold = FIELD_DEF_REFRESH_DAYS * 24 * 60 * 60 * 1000;
  const isStale = !rows?.length ||
    rows.some((r) => now - new Date(r.updated_at).getTime() > staleThreshold);

  if (rows?.length && !isStale) {
    // Fresh DB data — build map and return
    return Object.fromEntries(rows.map((r) => [r.field_id, r.field_key]));
  }

  // --- Fetch from GHL API and persist ---
  try {
    const client = await getGhlClient(locationId);
    const { data } = await client.get(`/locations/${locationId}/customFields`, {
      params: { model: 'opportunity' },
    });
    const fields = data?.customFields ?? [];

    if (!fields.length) {
      logger.warn(`getFieldKeyMap: GHL returned no custom fields for location=${locationId}`);
      return rows?.length ? Object.fromEntries(rows.map((r) => [r.field_id, r.field_key])) : {};
    }

    const upsertRows = fields
      .filter((f) => f.id && f.fieldKey)
      .map((f) => ({
        location_id: locationId,
        field_id:    f.id,
        field_key:   f.fieldKey,
        field_label: f.name ?? null,
        updated_at:  new Date().toISOString(),
      }));

    const { error: upsertErr } = await supabase
      .from('mh_pwa_location_custom_fields')
      .upsert(upsertRows, { onConflict: 'location_id,field_id' });

    if (upsertErr) {
      logger.warn(`getFieldKeyMap: DB upsert failed for location=${locationId}: ${upsertErr.message}`);
    } else {
      logger.info(`getFieldKeyMap: persisted ${upsertRows.length} field defs for location=${locationId}`);
    }

    return Object.fromEntries(upsertRows.map((r) => [r.field_id, r.field_key]));
  } catch (err) {
    logger.warn(`getFieldKeyMap: GHL API error for location=${locationId}: ${err.message}`);
    // Fall back to whatever is in DB even if stale
    return rows?.length ? Object.fromEntries(rows.map((r) => [r.field_id, r.field_key])) : {};
  }
}

// ---------------------------------------------------------------------------
// Custom-field extraction helper
// Supports both key names and UUIDs; handles fieldValue (GHL API) and value.
// ---------------------------------------------------------------------------
function extractCustomField(customFields, ...keys) {
  if (!Array.isArray(customFields)) return null;
  for (const key of keys) {
    const field = customFields.find(
      (f) => f.key === key || f.id === key || f.fieldKey === key
    );
    const val = field?.value ?? field?.fieldValue ?? null;
    if (val != null) return val;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parse scheduled date from a GHL custom field (text or date picker).
// ---------------------------------------------------------------------------
// fetchAndStoreTimezone — call GHL Location API and persist timezone to tenant.
// Fire-and-forget: called non-blocking after INSTALL. Silently no-ops if tokens
// are not yet available (OAuth flow hasn't completed yet).
// ---------------------------------------------------------------------------
async function fetchAndStoreTimezone(locationId) {
  try {
    const client = await getGhlClient(locationId);
    const { data } = await client.get(`/locations/${locationId}`);
    const tz = data?.location?.timezone ?? data?.timezone ?? null;
    if (!tz) return;

    await supabase
      .from('mh_pwa_tenants')
      .update({ timezone: tz, updated_at: new Date().toISOString() })
      .eq('location_id', locationId);

    logger.info(`Timezone stored for location=${locationId}: ${tz}`);
  } catch (err) {
    // Tokens may not be ready yet — this is expected at INSTALL time.
    logger.warn(`fetchAndStoreTimezone skipped for location=${locationId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// fetchAndStoreInvoiceSettings — seed per-location invoice config from GHL.
// Fire-and-forget: called non-blocking after INSTALL. Silently no-ops if
// tokens are not yet available (OAuth flow hasn't completed yet).
// ---------------------------------------------------------------------------
async function fetchAndStoreInvoiceSettings(locationId) {
  try {
    const client = await getGhlClient(locationId);
    const { data } = await client.get(`/locations/${locationId}`);
    const loc = data?.location ?? data ?? {};

    const address = loc.address || loc.city ? {
      addressLine1: loc.address  ?? null,
      city:         loc.city     ?? null,
      state:        loc.state    ?? null,
      postalCode:   loc.postalCode ?? loc.postal_code ?? null,
      countryCode:  loc.country  ?? loc.countryCode  ?? null,
    } : null;

    const updates = {
      updated_at: new Date().toISOString(),
      ...(loc.name    ? { invoice_business_name:      loc.name }    : {}),
      ...(loc.logoUrl ? { invoice_business_logo_url:  loc.logoUrl } : {}),
      ...(loc.phone   ? { invoice_business_phone:     loc.phone }   : {}),
      ...(loc.website ? { invoice_business_website:   loc.website } : {}),
      ...(address     ? { invoice_business_address:   address }     : {}),
    };

    await supabase
      .from('mh_pwa_tenants')
      .update(updates)
      .eq('location_id', locationId);

    logger.info(`Invoice settings seeded for location=${locationId}`);
  } catch (err) {
    logger.warn(`fetchAndStoreInvoiceSettings skipped for location=${locationId}: ${err.message}`);
  }
}

/**
 * Get the stored timezone for a location (with 'Australia/Sydney' fallback).
 */
async function getTenantTimezone(locationId) {
  const { data } = await supabase
    .from('mh_pwa_tenants')
    .select('timezone')
    .eq('location_id', locationId)
    .maybeSingle();
  return data?.timezone ?? 'Australia/Sydney';
}

// ---------------------------------------------------------------------------
// Build job upsert payload from a full GHL opportunity record
// ---------------------------------------------------------------------------
function buildJobPayload(opp, timezone = 'Australia/Sydney') {
  const contact      = opp.contact ?? {};
  const customFields = opp.customFields ?? opp.custom_fields ?? [];

  const customerName =
    contact.name ||
    `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() ||
    null;

  const customerPhone =
    contact.phone || contact.phoneRaw || null;

  const pickupAddress =
    extractCustomField(customFields, 'opportunity.pickup_address', 'pickup_address', 'pickup') ||
    opp.address1 ||
    null;

  const dropoffAddress =
    extractCustomField(customFields, 'opportunity.dropoff_address', 'dropoff_address', 'dropoff', 'delivery_address') ||
    null;

  const scheduledRaw =
    extractCustomField(customFields, 'opportunity.scheduled_date', 'scheduled_date', 'opportunity.move_date', 'move_date') ||
    opp.closeDate ||
    opp.close_date ||
    null;

  const itemSummary = extractCustomField(customFields, 'opportunity.item_summary', 'item_summary', 'items') || null;
  const crewNotes   = extractCustomField(customFields, 'opportunity.crew_notes', 'crew_notes', 'notes_for_crew', 'internal_notes') || null;

  const stageName    = opp.stage?.name ?? opp.stageName ?? null;
  const mappedStatus = mapStageToStatus(stageName);

  return {
    ghl_job_id:       opp.id,
    ghl_contact_id:   opp.contactId ?? opp.contact_id ?? contact.id ?? null,
    customer_name:    customerName,
    customer_phone:   customerPhone,
    pickup_address:   pickupAddress,
    dropoff_address:  dropoffAddress,
    scheduled_date: scheduledRaw ? parseScheduledDate(scheduledRaw, timezone) : null,
    estimated_value:  opp.monetaryValue ?? null,
    item_summary:     itemSummary,
    crew_notes:       crewNotes,
    // Only set status if mapped — never overwrite a crew-set status with null
    ...(mappedStatus ? { status: mappedStatus } : {}),
    raw_ghl_payload:  opp,
    updated_at:       new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Handler: AppInstall (type = "INSTALL")
// Registers or reactivates a tenant in mh_pwa_tenants.
// ---------------------------------------------------------------------------
async function handleInstall(body, logId) {
  const locationId = body.locationId;

  if (!locationId) {
    await updateSyncLog(logId, 'failed', 'INSTALL: missing locationId');
    return;
  }

  const trialStartsAt = body.trial?.trialStartDate ? new Date(body.trial.trialStartDate) : null;
  const trialDuration = body.trial?.trialDuration ?? null;
  const trialEndsAt   = trialStartsAt && trialDuration
    ? new Date(trialStartsAt.getTime() + trialDuration * 24 * 60 * 60 * 1000)
    : null;

  logger.info(`AppInstall: registering tenant location=${locationId} company="${body.companyName}"`);
  logActivity('system', 'app_install', { locationId, companyName: body.companyName });

  const { error } = await supabase
    .from('mh_pwa_tenants')
    .upsert(
      {
        location_id:         locationId,
        company_id:          body.companyId    ?? null,
        company_name:        body.companyName  ?? null,
        app_id:              body.appId        ?? null,
        installing_user_id:  body.userId       ?? null,
        plan_id:             body.planId       ?? null,
        is_active:           true,
        on_trial:            body.trial?.onTrial ?? false,
        trial_duration_days: trialDuration,
        trial_starts_at:     trialStartsAt?.toISOString() ?? null,
        trial_ends_at:       trialEndsAt?.toISOString()   ?? null,
        is_whitelabel:       body.isWhitelabelCompany ?? false,
        whitelabel_domain:   body.whitelabelDetails?.domain ?? null,
        installed_at:        new Date().toISOString(),
        uninstalled_at:      null,          // clear if reinstalling
        raw_install_payload: body,
        updated_at:          new Date().toISOString(),
      },
      { onConflict: 'location_id' }
    );

  if (error) {
    const msg = `AppInstall: tenant upsert failed for location=${locationId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`AppInstall: tenant registered/reactivated location=${locationId}`);
  await updateSyncLog(logId, 'success');

  // Clear stale custom field cache so reinstalls always get a fresh fetch.
  // If uninstall webhook was missed the rows are still there with old TTL —
  // wiping them here ensures the new install doesn't reuse stale mappings.
  await supabase
    .from('mh_pwa_location_custom_fields')
    .delete()
    .eq('location_id', locationId);

  // Best-effort: fetch data from GHL Location API. OAuth tokens may not
  // be ready yet; both calls silently skip on auth failure.
  fetchAndStoreTimezone(locationId);
  fetchAndStoreInvoiceSettings(locationId);

  // ---- Bootstrap tasks (fire in parallel, non-blocking) ----
  // Runs immediately AND again after 45s delay in case OAuth tokens weren't
  // ready on the first attempt (GHL fires INSTALL before tokens are issued).
  async function runBootstrap(attempt) {
    const tag = attempt === 1 ? 'AppInstall bootstrap' : 'AppInstall bootstrap retry';

    const tasks = [
      // Task 1: Bulk upsert GHL users as crew members
      (async () => {
        const client = await getGhlClient(locationId);
        const { data: userData } = await client.get('/users/', {
          params: { locationId },
        });
        const users = userData?.users ?? [];
        const crewRows = users
          .filter((u) => u.phone)
          .map((u) => ({
            ghl_user_id: u.id,
            phone:       u.phone,
            full_name:   [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || '',
            location_id: locationId,
            role:        u.roles?.role === 'admin' ? 'admin' : 'crew',
            is_active:   true,
            updated_at:  new Date().toISOString(),
          }));

        if (!crewRows.length) {
          logger.info(`${tag}: no users with phone for location=${locationId}`);
          return;
        }

        const { error } = await supabase
          .from('mh_pwa_crew_users')
          .upsert(crewRows, { onConflict: 'ghl_user_id' });

        if (error) {
          logger.warn(`${tag} users upsert error location=${locationId}: ${error.message}`);
        } else {
          logger.info(`${tag}: upserted ${crewRows.length} crew users for location=${locationId}`);
        }
      })(),

      // Task 2: Provision required custom fields (create if missing), then cache definitions
      (async () => {
        const provResult = await provisionCustomFields(locationId);
        logger.info(`${tag}: custom fields — created=[${provResult.created}] existing=[${provResult.existing}] failed=[${provResult.failed}] location=${locationId}`);
        const map = await getFieldKeyMap(locationId);
        logger.info(`${tag}: cached ${Object.keys(map).length} custom fields for location=${locationId}`);
      })(),

      // Task 3: Fetch pipelines and upsert all stages
      (async () => {
        const client = await getGhlClient(locationId);
        const { data: pipelineData } = await client.get('/opportunities/pipelines', {
          params: { locationId },
        });
        const pipelines = pipelineData?.pipelines ?? [];
        const stageRows = [];

        for (const pipeline of pipelines) {
          for (const stage of (pipeline.stages ?? [])) {
            stageRows.push({
              location_id: locationId,
              pipeline_id: pipeline.id,
              stage_id:    stage.id,
              stage_name:  stage.name,
              sort_order:  stage.position ?? null,
              updated_at:  new Date().toISOString(),
            });
          }
        }

        if (!stageRows.length) {
          logger.info(`${tag}: no stages found for location=${locationId}`);
          return;
        }

        const { error } = await supabase
          .from('mh_pwa_pipeline_stages')
          .upsert(stageRows, { onConflict: 'location_id,stage_id', ignoreDuplicates: false });

        if (error) {
          logger.warn(`${tag} stages upsert error location=${locationId}: ${error.message}`);
        } else {
          logger.info(`${tag}: upserted ${stageRows.length} pipeline stages for location=${locationId}`);
        }
      })(),
    ];

    const results = await Promise.allSettled(tasks);
    const failed  = results.filter((r) => r.status === 'rejected');
    failed.forEach((r, i) => {
      logger.warn(`${tag} task ${i + 1} failed location=${locationId}: ${r.reason?.message ?? r.reason}`);
    });
    return failed.length;
  }

  // First attempt — may fail if OAuth tokens aren't ready yet
  runBootstrap(1).then((failCount) => {
    if (failCount > 0) {
      // Schedule a retry 45 seconds later to give GHL time to issue tokens
      logger.info(`AppInstall: ${failCount} bootstrap task(s) failed — retrying in 45s for location=${locationId}`);
      setTimeout(() => {
        fetchAndStoreTimezone(locationId);
        fetchAndStoreInvoiceSettings(locationId);
        runBootstrap(2).catch((err) => {
          logger.warn(`AppInstall bootstrap retry error location=${locationId}: ${err.message}`);
        });
      }, 45_000);
    }
  });
}

// ---------------------------------------------------------------------------
// Handler: AppUninstall (type = "UNINSTALL")
// Deactivates the tenant — preserves all data.
// ---------------------------------------------------------------------------
async function handleUninstall(body, logId) {
  const locationId = body.locationId;

  if (!locationId) {
    await updateSyncLog(logId, 'failed', 'UNINSTALL: missing locationId');
    return;
  }

  logger.info(`AppUninstall: deactivating tenant location=${locationId}`);
  logActivity('system', 'app_uninstall', { locationId });

  const { error } = await supabase
    .from('mh_pwa_tenants')
    .update({
      is_active:      false,
      uninstalled_at: new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    })
    .eq('location_id', locationId);

  if (error) {
    const msg = `AppUninstall: DB error for location=${locationId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`AppUninstall: tenant deactivated location=${locationId}`);
  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Handler: PlanChange (type = "PLAN_CHANGE")
// Updates the tenant's active plan.
// ---------------------------------------------------------------------------
async function handlePlanChange(body, logId) {
  const locationId = body.locationId;
  const newPlanId  = body.newPlanId;

  if (!locationId || !newPlanId) {
    await updateSyncLog(logId, 'failed', 'PLAN_CHANGE: missing locationId or newPlanId');
    return;
  }

  logger.info(`PlanChange: location=${locationId} ${body.currentPlanId} → ${newPlanId}`);

  const { error } = await supabase
    .from('mh_pwa_tenants')
    .update({
      plan_id:    newPlanId,
      on_trial:   false,   // plan change implies they've left trial
      updated_at: new Date().toISOString(),
    })
    .eq('location_id', locationId);

  if (error) {
    const msg = `PlanChange: DB error for location=${locationId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`PlanChange: plan updated for location=${locationId}`);
  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Handler: LocationUpdate (type = "LocationUpdate")
// Syncs company name changes to mh_pwa_tenants.
// NOTE: LocationUpdate uses body.id (not body.locationId) as the location key.
// ---------------------------------------------------------------------------
async function handleLocationUpdate(body, logId) {
  const locationId = body.id; // LocationUpdate uses 'id', not 'locationId'

  if (!locationId) {
    await updateSyncLog(logId, 'failed', 'LocationUpdate: missing id');
    return;
  }

  logger.info(`LocationUpdate: location=${locationId} name="${body.name}"`);

  const { error } = await supabase
    .from('mh_pwa_tenants')
    .update({
      company_name: body.name      ?? null,
      updated_at:   new Date().toISOString(),
    })
    .eq('location_id', locationId);

  if (error) {
    const msg = `LocationUpdate: DB error for location=${locationId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`LocationUpdate: company name synced for location=${locationId}`);
  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Handler: OpportunityCreate / OpportunityUpdate / OpportunityStageUpdate
// Fetches full opportunity from GHL API (has custom fields + stage.name),
// then upserts into mh_pwa_jobs.
// ---------------------------------------------------------------------------
async function handleOpportunityUpsert(body, logId) {
  const ghlJobId = body.id;

  if (!ghlJobId) {
    const msg = 'Opportunity upsert: missing id in webhook body';
    logger.warn(msg, { body });
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`Fetching full opportunity from GHL API: ${ghlJobId} location=${body.locationId}`);
  const opp = await fetchFullOpportunity(ghlJobId, body.locationId);

  if (!opp) {
    const msg = `Could not fetch opportunity ${ghlJobId} from GHL API`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  // Resolve field UUIDs → fieldKey names so extractCustomField can match by name.
  // GHL returns customFields as [{ id, fieldValue }] — no key on the opp fetch.
  const fieldKeyMap = await getFieldKeyMap(body.locationId);
  if (Array.isArray(opp.customFields)) {
    opp.customFields = opp.customFields.map((f) => ({
      ...f,
      key: fieldKeyMap[f.id] ?? f.key ?? null,
    }));
    logger.info(`Resolved custom fields: ${JSON.stringify(opp.customFields)}`);
  }

  const timezone = await getTenantTimezone(body.locationId);
  const payload = { ...buildJobPayload(opp, timezone), location_id: body.locationId };
  logger.info(`Upserting job ghl_job_id=${ghlJobId} location=${body.locationId} status=${payload.status ?? '(unchanged)'}`);

  const { error } = await supabase
    .from('mh_pwa_jobs')
    .upsert(payload, { onConflict: 'ghl_job_id' });

  if (error) {
    const msg = `Job upsert failed for ghl_job_id=${ghlJobId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`Job upserted: ghl_job_id=${ghlJobId}`);
  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Handler: OpportunityStatusUpdate
// won → completed, lost → cancelled, open → no-op
// ---------------------------------------------------------------------------
async function handleOpportunityStatusUpdate(body, logId) {
  const ghlJobId  = body.id;
  const ghlStatus = body.status;

  if (!ghlJobId) {
    await updateSyncLog(logId, 'failed', 'Missing id in OpportunityStatusUpdate body');
    return;
  }

  const statusMap = { won: 'completed', lost: 'cancelled' };
  const jobStatus = statusMap[ghlStatus];

  if (!jobStatus) {
    logger.info(`OpportunityStatusUpdate: ghl_status="${ghlStatus}" — no action needed`);
    await updateSyncLog(logId, 'success');
    return;
  }

  logger.info(`OpportunityStatusUpdate: ghl_job_id=${ghlJobId} ${ghlStatus} → ${jobStatus}`);

  const { error } = await supabase
    .from('mh_pwa_jobs')
    .update({ status: jobStatus, updated_at: new Date().toISOString() })
    .eq('ghl_job_id', ghlJobId)
    .eq('location_id', body.locationId);

  if (error) {
    const msg = `OpportunityStatusUpdate DB error for ${ghlJobId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Handler: OpportunityDelete
// ---------------------------------------------------------------------------
async function handleOpportunityDelete(body, logId) {
  const ghlJobId = body.id;

  if (!ghlJobId) {
    await updateSyncLog(logId, 'failed', 'Missing id in OpportunityDelete body');
    return;
  }

  logger.info(`OpportunityDelete: marking cancelled ghl_job_id=${ghlJobId}`);

  const { error } = await supabase
    .from('mh_pwa_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('ghl_job_id', ghlJobId)
    .eq('location_id', body.locationId);

  if (error) {
    const msg = `OpportunityDelete DB error for ${ghlJobId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Handler: OpportunityAssignedToUpdate
// body.id         = GHL opportunity ID → mh_pwa_jobs.ghl_job_id
// body.assignedTo = GHL user/staff ID  → mh_pwa_crew_users.ghl_user_id
// Replaces the GHL-sourced assignment; manual app assignments are untouched.
// ---------------------------------------------------------------------------
async function handleAssignedToUpdate(body, logId) {
  const ghlJobId  = body.id;
  const ghlUserId = body.assignedTo;

  if (!ghlJobId) {
    await updateSyncLog(logId, 'failed', 'Missing id in OpportunityAssignedToUpdate body');
    return;
  }

  if (!ghlUserId) {
    logger.info(`OpportunityAssignedToUpdate: assignedTo cleared for opp=${ghlJobId}, skipping`);
    await updateSyncLog(logId, 'success');
    return;
  }

  // Resolve job — scoped to this tenant
  const { data: job, error: jobErr } = await supabase
    .from('mh_pwa_jobs')
    .select('id')
    .eq('ghl_job_id', ghlJobId)
    .eq('location_id', body.locationId)
    .maybeSingle();

  if (jobErr) {
    const msg = `AssignedToUpdate: job lookup error for ghl_job_id=${ghlJobId}: ${jobErr.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  if (!job) {
    const msg = `AssignedToUpdate: no job found for ghl_job_id=${ghlJobId} location=${body.locationId} (may not be synced yet)`;
    logger.warn(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  // Resolve crew user — scoped to this tenant
  const { data: crewUser, error: crewErr } = await supabase
    .from('mh_pwa_crew_users')
    .select('id')
    .eq('ghl_user_id', ghlUserId)
    .eq('location_id', body.locationId)
    .maybeSingle();

  if (crewErr) {
    const msg = `AssignedToUpdate: crew lookup error for ghl_user_id=${ghlUserId}: ${crewErr.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  if (!crewUser) {
    const msg = `AssignedToUpdate: no crew_user with ghl_user_id=${ghlUserId} location=${body.locationId} — not synced yet`;
    logger.warn(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`AssignedToUpdate: assigning crew_user=${crewUser.id} to job=${job.id}`);

  // Remove existing GHL-sourced assignment, insert the new one
  const { error: deleteErr } = await supabase
    .from('mh_pwa_job_crew_assignments')
    .delete()
    .eq('job_id', job.id)
    .eq('assigned_by', 'ghl');

  if (deleteErr) {
    logger.warn(`AssignedToUpdate: could not remove old GHL assignment: ${deleteErr.message}`);
  }

  const { error: insertErr } = await supabase
    .from('mh_pwa_job_crew_assignments')
    .upsert(
      { job_id: job.id, crew_user_id: crewUser.id, assigned_by: 'ghl' },
      { onConflict: 'job_id,crew_user_id', ignoreDuplicates: false }
    );

  if (insertErr) {
    const msg = `AssignedToUpdate: assignment insert failed: ${insertErr.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  logger.info(`AssignedToUpdate: crew_user=${crewUser.id} assigned to job=${job.id}`);
  await updateSyncLog(logId, 'success');

  // Push notification to the assigned crew member (fire-and-forget)
  const locationId = body.locationId;
  if (locationId) {
    (async () => {
      try {
        const settings = await getNotificationSettings(locationId);
        if (settings.crewJobAssigned) {
          // Fetch job details for notification body
          const { data: jobDetail } = await supabase
            .from('mh_pwa_jobs')
            .select('customer_name, scheduled_date')
            .eq('id', job.id)
            .maybeSingle();

          const customerName = jobDetail?.customer_name ?? 'a customer';
          const dateStr = jobDetail?.scheduled_date
            ? new Date(jobDetail.scheduled_date).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
            : null;

          await notifyUser(crewUser.id, {
            title: 'New Job Assigned',
            body:  `You have been assigned a job${customerName ? ` for ${customerName}` : ''}${dateStr ? ` on ${dateStr}` : ''}`,
            url:   `/jobs/${job.id}`,
            tag:   `job-assigned-${job.id}`,
          });
        }
      } catch (err) {
        logger.error(`Job assignment push notification failed: ${err.message}`);
      }
    })();
  }
}

// ---------------------------------------------------------------------------
// Handler: UserCreate / UserUpdate
// Provisions or updates a crew member in mh_pwa_crew_users.
// ---------------------------------------------------------------------------
async function handleUserUpsert(body, logId) {
  const ghlUserId = body.id;
  const phone     = body.phone ?? null;
  const fullName  = [body.firstName, body.lastName].filter(Boolean).join(' ') || body.name || null;

  if (!ghlUserId) {
    await updateSyncLog(logId, 'failed', 'UserCreate/Update: missing user id');
    return;
  }

  if (!phone) {
    logger.warn(`UserUpsert: GHL user ${ghlUserId} has no phone — skipping (phone is login identifier)`);
    await updateSyncLog(logId, 'success');
    return;
  }

  logger.info(`UserUpsert: ghl_user_id=${ghlUserId} location=${body.locationId} phone=${phone} name="${fullName}"`);

  const { error } = await supabase
    .from('mh_pwa_crew_users')
    .upsert(
      {
        ghl_user_id: ghlUserId,
        phone,
        full_name:   fullName ?? '',
        location_id: body.locationId,
        is_active:   true,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'ghl_user_id' }
    );

  if (error) {
    if (error.code === '23505') {
      // Phone conflict — user was manually created before GHL sync; patch by phone
      const { error: patchErr } = await supabase
        .from('mh_pwa_crew_users')
        .update({
          ghl_user_id: ghlUserId,
          full_name:   fullName ?? '',
          location_id: body.locationId,
          is_active:   true,
          updated_at:  new Date().toISOString(),
        })
        .eq('phone', phone);

      if (patchErr) {
        const msg = `UserUpsert: phone conflict patch failed for ${phone}: ${patchErr.message}`;
        logger.error(msg);
        await updateSyncLog(logId, 'failed', msg);
        return;
      }
      logger.info(`UserUpsert: patched existing crew user by phone=${phone} with ghl_user_id=${ghlUserId}`);
    } else {
      const msg = `UserUpsert: DB error for ghl_user_id=${ghlUserId}: ${error.message}`;
      logger.error(msg);
      await updateSyncLog(logId, 'failed', msg);
      return;
    }
  }

  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Handler: UserDelete
// Soft-disables the crew member — preserves all job history.
// ---------------------------------------------------------------------------
async function handleUserDelete(body, logId) {
  const ghlUserId = body.id;

  if (!ghlUserId) {
    await updateSyncLog(logId, 'failed', 'UserDelete: missing user id');
    return;
  }

  logger.info(`UserDelete: soft-disabling ghl_user_id=${ghlUserId}`);

  const { error } = await supabase
    .from('mh_pwa_crew_users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('ghl_user_id', ghlUserId)
    .eq('location_id', body.locationId);

  if (error) {
    const msg = `UserDelete: DB error for ghl_user_id=${ghlUserId}: ${error.message}`;
    logger.error(msg);
    await updateSyncLog(logId, 'failed', msg);
    return;
  }

  await updateSyncLog(logId, 'success');
}

// ---------------------------------------------------------------------------
// Main webhook handler
// ---------------------------------------------------------------------------
async function ghlHandler(req, res) {
  // --- Ed25519 signature verification ---
  const rawBody   = req.rawBody;
  const signature = req.headers['x-ghl-signature'];

  if (!verifySignature(rawBody, signature)) {
    logger.warn('GHL webhook signature verification failed', { ip: req.ip });
    logActivity('webhook', 'signature_failed', { ip: req.ip }, 'warn');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body       = req.body;
  const eventType  = body.type || body.event || 'unknown';
  // LocationUpdate uses body.id as the location key — all others use body.locationId
  const locationId = eventType === 'LocationUpdate' ? body.id : (body.locationId ?? null);

  logger.info(`GHL inbound webhook: event=${eventType} location=${locationId}`);
  logActivity('webhook', 'received', { locationId, eventType, opportunityId: body.id });

  // --- Tenant validation gate ---
  // All events except INSTALL must originate from a known active tenant.
  const tenantOk = await isTenantActive(locationId, eventType);
  if (!tenantOk) {
    logger.warn(`Tenant gate rejected: event=${eventType} location=${locationId}`);
    logActivity('webhook', 'tenant_rejected', { locationId, eventType }, 'warn');
    return res.status(200).json({ received: true, skipped: 'unknown or inactive tenant' });
  }

  const logId = await createSyncLog(eventType, body, locationId);

  try {
    switch (eventType) {
      // --- Tenant lifecycle ---
      case 'INSTALL':
      case 'AppInstall':
        await handleInstall(body, logId);
        break;

      case 'UNINSTALL':
      case 'AppUninstall':
        await handleUninstall(body, logId);
        break;

      case 'PLAN_CHANGE':
      case 'PlanChange':
        await handlePlanChange(body, logId);
        break;

      case 'LocationUpdate':
        await handleLocationUpdate(body, logId);
        break;

      // --- Opportunity (job) events ---
      case 'OpportunityCreate':
        await handleOpportunityUpsert(body, logId);
        if (body.assignedTo) await handleAssignedToUpdate(body, logId);
        break;

      case 'OpportunityUpdate':
      case 'OpportunityStageUpdate':
        await handleOpportunityUpsert(body, logId);
        break;

      case 'OpportunityStatusUpdate':
        await handleOpportunityStatusUpdate(body, logId);
        break;

      case 'OpportunityAssignedToUpdate':
        await handleAssignedToUpdate(body, logId);
        break;

      case 'OpportunityDelete':
        await handleOpportunityDelete(body, logId);
        break;

      // --- User (crew member) events ---
      case 'UserCreate':
      case 'UserUpdate':
        await handleUserUpsert(body, logId);
        break;

      case 'UserDelete':
        await handleUserDelete(body, logId);
        break;

      default:
        logger.info(`GHL webhook: unhandled event "${eventType}", acknowledging`);
        await updateSyncLog(logId, 'success');
        break;
    }
  } catch (err) {
    logger.error(`GHL webhook processing error for event=${eventType}: ${err.message}`, { stack: err.stack });
    logActivity('webhook', 'processing_error', { locationId, eventType, error: err.message }, 'error');
    await updateSyncLog(logId, 'failed', err.message);
    // Return 200 so GHL doesn't retry non-transient bugs
  }

  return res.status(200).json({ received: true });
}

module.exports = ghlHandler;
