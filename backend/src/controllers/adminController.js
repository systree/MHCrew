'use strict';

const supabase                        = require('../services/supabase');
const { getGhlClient }                = require('../services/ghl');
const logger                          = require('../utils/logger');
const { logActivity }                 = require('../utils/logger');
const { provisionCustomFields }       = require('../services/ghlOutbound');
const { STAGE_STATUS_MAP, mapStageToStatus } = require('../utils/stageStatusMap');
const { parseScheduledDate } = require('../utils/dateUtils');

// ---------------------------------------------------------------------------
// Role guard middleware
// ---------------------------------------------------------------------------
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Resolve custom field UUIDs → field keys from DB
// ---------------------------------------------------------------------------
async function resolveFieldKeyMap(locationId) {
  const { data: rows } = await supabase
    .from('mh_pwa_location_custom_fields')
    .select('field_id, field_key')
    .eq('location_id', locationId);
  return rows ? Object.fromEntries(rows.map((r) => [r.field_id, r.field_key])) : {};
}

// ---------------------------------------------------------------------------
// getPipelines — GET /api/admin/pipelines
// ---------------------------------------------------------------------------
async function getPipelines(req, res) {
  const locationId = req.user.locationId;

  try {
    const client = await getGhlClient(locationId);
    const { data: ghlData } = await client.get('/opportunities/pipelines', {
      params: { locationId },
    });

    const { data: tenant } = await supabase
      .from('mh_pwa_tenants')
      .select('pipeline_id')
      .eq('location_id', locationId)
      .maybeSingle();

    return res.json({
      pipelines:         ghlData?.pipelines ?? [],
      currentPipelineId: tenant?.pipeline_id ?? null,
    });
  } catch (err) {
    logger.error(`getPipelines error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch pipelines' });
  }
}

// ---------------------------------------------------------------------------
// setPipeline — POST /api/admin/pipeline
// Body: { pipelineId }
// ---------------------------------------------------------------------------
async function setPipeline(req, res) {
  const locationId  = req.user.locationId;
  const { pipelineId } = req.body;

  if (!pipelineId) {
    return res.status(422).json({ error: 'pipelineId is required' });
  }

  try {
    // Upsert so pipeline_id is stored even if the tenant row was wiped (e.g. after a nuke)
    const { error: tenantErr } = await supabase
      .from('mh_pwa_tenants')
      .upsert(
        { location_id: locationId, pipeline_id: pipelineId, updated_at: new Date().toISOString() },
        { onConflict: 'location_id' }
      );

    if (tenantErr) {
      logger.error(`setPipeline tenant upsert error location=${locationId}: ${tenantErr.message}`);
      return res.status(500).json({ error: 'Failed to update pipeline' });
    }

    // Fetch all pipelines from GHL to find the stages for this pipeline
    const client = await getGhlClient(locationId);
    const { data: ghlData } = await client.get('/opportunities/pipelines', {
      params: { locationId },
    });

    const pipeline = (ghlData?.pipelines ?? []).find((p) => p.id === pipelineId);
    if (pipeline?.stages?.length) {
      const upsertRows = pipeline.stages.map((stage) => ({
        location_id: locationId,
        pipeline_id: pipelineId,
        stage_id:    stage.id,
        stage_name:  stage.name,
        sort_order:  stage.position ?? null,
        updated_at:  new Date().toISOString(),
      }));

      // onConflict on (location_id, stage_id) — preserve existing job_status
      const { error: upsertErr } = await supabase
        .from('mh_pwa_pipeline_stages')
        .upsert(upsertRows, {
          onConflict:       'location_id,stage_id',
          ignoreDuplicates: false,
        });

      if (upsertErr) {
        logger.warn(`setPipeline stages upsert error location=${locationId}: ${upsertErr.message}`);
      } else {
        logger.info(`setPipeline: upserted ${upsertRows.length} stages for pipeline=${pipelineId} location=${locationId}`);
      }
    }

    logActivity('admin', 'pipeline_set', { userId: req.user.userId, locationId, pipelineId });
    return res.json({ ok: true });
  } catch (err) {
    logger.error(`setPipeline error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to set pipeline' });
  }
}

// ---------------------------------------------------------------------------
// getStages — GET /api/admin/stages
// ---------------------------------------------------------------------------
async function getStages(req, res) {
  const locationId = req.user.locationId;

  try {
    const { data: tenant } = await supabase
      .from('mh_pwa_tenants')
      .select('pipeline_id')
      .eq('location_id', locationId)
      .maybeSingle();

    if (!tenant?.pipeline_id) {
      return res.json({ stages: [], pipelineId: null });
    }

    const pipelineId = tenant.pipeline_id;

    const { data: stages, error } = await supabase
      .from('mh_pwa_pipeline_stages')
      .select('*')
      .eq('location_id', locationId)
      .eq('pipeline_id', pipelineId)
      .order('sort_order', { ascending: true, nullsFirst: false });

    if (error) {
      logger.error(`getStages DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch stages' });
    }

    return res.json({ stages: stages ?? [], pipelineId });
  } catch (err) {
    logger.error(`getStages error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch stages' });
  }
}

// ---------------------------------------------------------------------------
// setStages — POST /api/admin/stages
// Body: { mappings: [{ stageId, jobStatus }] }
// ---------------------------------------------------------------------------
async function setStages(req, res) {
  const locationId = req.user.locationId;
  const { mappings } = req.body;

  if (!Array.isArray(mappings)) {
    return res.status(422).json({ error: 'mappings must be an array' });
  }

  try {
    let updated = 0;

    for (const { stageId, jobStatus } of mappings) {
      if (!stageId) continue;

      const { error } = await supabase
        .from('mh_pwa_pipeline_stages')
        .update({ job_status: jobStatus ?? null, updated_at: new Date().toISOString() })
        .eq('location_id', locationId)
        .eq('stage_id', stageId);

      if (error) {
        logger.warn(`setStages update error location=${locationId} stage=${stageId}: ${error.message}`);
      } else {
        updated++;
      }
    }

    logActivity('admin', 'stages_updated', { userId: req.user.userId, locationId, updated });
    return res.json({ ok: true, updated });
  } catch (err) {
    logger.error(`setStages error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to update stage mappings' });
  }
}

// ---------------------------------------------------------------------------
// getCrew — GET /api/admin/crew
// ---------------------------------------------------------------------------
async function getCrew(req, res) {
  const locationId = req.user.locationId;

  try {
    const { data: crew, error } = await supabase
      .from('mh_pwa_crew_users')
      .select('id, full_name, phone, role, is_active, ghl_user_id, created_at')
      .eq('location_id', locationId)
      .order('full_name', { ascending: true });

    if (error) {
      logger.error(`getCrew DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch crew' });
    }

    return res.json({ crew: crew ?? [] });
  } catch (err) {
    logger.error(`getCrew error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch crew' });
  }
}

// ---------------------------------------------------------------------------
// updateCrewMember — PATCH /api/admin/crew/:id
// Body: { isActive?, role? }
// ---------------------------------------------------------------------------
async function updateCrewMember(req, res) {
  const locationId = req.user.locationId;
  const { id }     = req.params;
  const { isActive, role } = req.body;

  const updatePayload = { updated_at: new Date().toISOString() };
  if (isActive !== undefined) updatePayload.is_active = isActive;
  if (role !== undefined)     updatePayload.role = role;

  try {
    const { data: rows, error } = await supabase
      .from('mh_pwa_crew_users')
      .update(updatePayload)
      .eq('id', id)
      .eq('location_id', locationId)
      .select('*');

    if (error) {
      logger.error(`updateCrewMember DB error location=${locationId} id=${id}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to update crew member' });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Crew member not found' });
    }

    logActivity('admin', 'crew_updated', { userId: req.user.userId, locationId, targetId: id, changes: req.body });
    return res.json({ ok: true, member: rows[0] });
  } catch (err) {
    logger.error(`updateCrewMember error location=${locationId} id=${id}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to update crew member' });
  }
}

// ---------------------------------------------------------------------------
// syncJobs — POST /api/admin/sync-jobs
// Bootstraps all opportunities from the selected pipeline into mh_pwa_jobs.
// ---------------------------------------------------------------------------
async function syncJobs(req, res) {
  const locationId = req.user.locationId;

  try {
    // Get pipeline_id and timezone from tenant
    const { data: tenant } = await supabase
      .from('mh_pwa_tenants')
      .select('pipeline_id, timezone')
      .eq('location_id', locationId)
      .maybeSingle();

    if (!tenant?.pipeline_id) {
      return res.status(400).json({ error: 'No pipeline selected. Set pipeline first.' });
    }

    const pipelineId = tenant.pipeline_id;
    const timezone   = tenant.timezone ?? 'Australia/Sydney';

    // Fetch opportunities from GHL
    const client = await getGhlClient(locationId);
    const { data: ghlData } = await client.get('/opportunities/search', {
      params: {
        location_id: locationId,
        pipeline_id: pipelineId,
        status:      'open',
        limit:       100,
      },
    });

    const opportunities = ghlData?.opportunities ?? ghlData?.data ?? [];

    // Fetch field key map for resolving custom field UUIDs
    const fieldKeyMap = await resolveFieldKeyMap(locationId);

    // Build job payloads
    const jobRows = opportunities.map((opp) => {
      const contact      = opp.contact ?? {};
      const rawCF        = opp.customFields ?? opp.custom_fields ?? [];

      // Resolve field UUIDs to keys
      const customFields = rawCF.map((f) => ({
        ...f,
        key: fieldKeyMap[f.id] ?? f.key ?? f.fieldKey ?? null,
      }));

      function extractCF(...keys) {
        for (const key of keys) {
          const field = customFields.find(
            (f) => f.key === key || f.id === key || f.fieldKey === key
          );
          const val = field?.value ?? field?.fieldValue ?? null;
          if (val != null) return val;
        }
        return null;
      }

      const customerName =
        contact.name ||
        `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() ||
        null;

      const stageName    = opp.stage?.name ?? opp.stageName ?? null;
      const mappedStatus = mapStageToStatus(stageName);

      const scheduledRaw =
        extractCF('opportunity.scheduled_date', 'scheduled_date', 'opportunity.move_date', 'move_date') ||
        opp.closeDate ||
        opp.close_date ||
        null;

      return {
        ghl_job_id:      opp.id,
        ghl_contact_id:  opp.contactId ?? opp.contact_id ?? contact.id ?? null,
        customer_name:   customerName,
        customer_phone:  contact.phone || contact.phoneRaw || null,
        pickup_address:  extractCF('opportunity.pickup_address', 'pickup_address', 'pickup') || opp.address1 || null,
        dropoff_address: extractCF('opportunity.dropoff_address', 'dropoff_address', 'dropoff', 'delivery_address') || null,
        scheduled_date:  scheduledRaw ? parseScheduledDate(scheduledRaw, timezone) : null,
        estimated_value: opp.monetaryValue ?? null,
        item_summary:    extractCF('opportunity.item_summary', 'item_summary', 'items') || null,
        crew_notes:      extractCF('opportunity.crew_notes', 'crew_notes', 'notes_for_crew', 'internal_notes') || null,
        ...(mappedStatus ? { status: mappedStatus } : {}),
        location_id:     locationId,
        raw_ghl_payload: opp,
        updated_at:      new Date().toISOString(),
      };
    });

    if (jobRows.length === 0) {
      return res.json({ ok: true, synced: 0 });
    }

    const { error: upsertErr } = await supabase
      .from('mh_pwa_jobs')
      .upsert(jobRows, { onConflict: 'ghl_job_id' });

    if (upsertErr) {
      logger.error(`syncJobs upsert error location=${locationId}: ${upsertErr.message}`);
      return res.status(500).json({ error: 'Failed to sync jobs' });
    }

    logger.info(`syncJobs: synced ${jobRows.length} jobs for location=${locationId} pipeline=${pipelineId}`);
    logActivity('admin', 'sync_jobs', { userId: req.user.userId, locationId, pipelineId, synced: jobRows.length });
    return res.json({ ok: true, synced: jobRows.length });
  } catch (err) {
    logger.error(`syncJobs error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to sync jobs' });
  }
}

// ---------------------------------------------------------------------------
// refreshFields — POST /api/admin/refresh-fields (JWT-protected version)
// ---------------------------------------------------------------------------
async function refreshFields(req, res) {
  const locationId = req.user.locationId;

  try {
    const { error } = await supabase
      .from('mh_pwa_location_custom_fields')
      .delete()
      .eq('location_id', locationId);

    if (error) {
      logger.error(`refreshFields DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    logger.info(`refreshFields: cleared field cache for location=${locationId}`);
    return res.json({ ok: true, message: `Field cache cleared for ${locationId}. Re-fire any opportunity webhook to rebuild.` });
  } catch (err) {
    logger.error(`refreshFields error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to refresh fields' });
  }
}

// ---------------------------------------------------------------------------
// provisionFields — POST /api/admin/provision-fields
// Creates the 6 required GHL opportunity custom fields if they don't exist,
// then refreshes the local field cache. Safe to call multiple times.
// ---------------------------------------------------------------------------
async function provisionFields(req, res) {
  const locationId = req.user.locationId;

  try {
    const provResult = await provisionCustomFields(locationId);
    logger.info(`provisionFields: created=[${provResult.created}] existing=[${provResult.existing}] failed=[${provResult.failed}] location=${locationId}`);
    logActivity('admin', 'provision_fields', { locationId, ...provResult });
    return res.json({ ok: true, ...provResult });
  } catch (err) {
    logger.error(`provisionFields error location=${locationId}: ${err.message}`);
    return res.status(502).json({ error: 'Could not reach GHL API. OAuth tokens may not be ready — try again in a minute.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/jobs
// List all jobs for this location with optional status filter.
// ---------------------------------------------------------------------------
async function getJobs(req, res) {
  const locationId = req.user.locationId;
  const { status } = req.query;

  try {
    let query = supabase
      .from('mh_pwa_jobs')
      .select('id, ghl_job_id, ghl_contact_id, status, customer_name, pickup_address, dropoff_address, scheduled_date, notes, cancellation_reason, created_at, updated_at')
      .eq('location_id', locationId)
      .order('scheduled_date', { ascending: false, nullsFirst: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const jobs = data ?? [];

    // Fetch crew assignments for all jobs in one query
    if (jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      const { data: assignments } = await supabase
        .from('mh_pwa_job_crew_assignments')
        .select('job_id, mh_pwa_crew_users(id, full_name)')
        .in('job_id', jobIds);

      const crewByJob = {};
      for (const a of assignments ?? []) {
        if (!crewByJob[a.job_id]) crewByJob[a.job_id] = [];
        if (a.mh_pwa_crew_users) crewByJob[a.job_id].push(a.mh_pwa_crew_users.full_name);
      }
      for (const job of jobs) {
        job.crew = crewByJob[job.id] ?? [];
      }
    }

    return res.json({ jobs });
  } catch (err) {
    logger.error(`getJobs (admin) error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to load jobs' });
  }
}

// ---------------------------------------------------------------------------
// getAdminJobEstimates — GET /api/admin/jobs/:jobId/estimates
// Fetches all GHL estimates for the contact linked to a job (admin only).
// ---------------------------------------------------------------------------
async function getAdminJobEstimates(req, res) {
  const locationId = req.user.locationId;
  const { jobId }  = req.params;

  try {
    const { data: job, error: jobErr } = await supabase
      .from('mh_pwa_jobs')
      .select('id, ghl_contact_id')
      .eq('id', jobId)
      .eq('location_id', locationId)
      .maybeSingle();

    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });
    if (!job.ghl_contact_id) return res.json({ estimates: [] });

    const client = await getGhlClient(locationId);
    const { data: ghlData } = await client.get('/invoices/estimate/list', {
      headers: { Version: '2023-02-21' },
      params: {
        altId:     locationId,
        altType:   'location',
        contactId: job.ghl_contact_id,
        limit:     10,
        offset:    0,
      },
    });

    const raw = ghlData?.estimates ?? ghlData?.data ?? [];
    const estimates = raw.map((e) => ({
      id:             e._id ?? e.id,
      title:          e.name ?? e.title ?? null,
      estimateNumber: e.estimateNumber ?? null,
      prefix:         e.estimateNumberPrefix ?? 'EST-',
      status:         e.estimateStatus ?? e.status ?? 'draft',
      total:          e.total ?? 0,
      issueDate:      e.issueDate ?? null,
      expiryDate:     e.expiryDate ?? null,
      items:          (e.items ?? []).map((li) => ({
        name:      li.name ?? li.description ?? '',
        qty:       li.qty ?? 1,
        unitPrice: li.amount ?? 0,
      })),
    }));

    logger.info(`getAdminJobEstimates: ${estimates.length} estimates for job=${jobId}`);
    return res.json({ estimates });
  } catch (err) {
    if (err.status === 404) return res.json({ estimates: [] });
    logger.error(`getAdminJobEstimates error job=${jobId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch estimates' });
  }
}

// ---------------------------------------------------------------------------
// syncLocation — POST /api/admin/sync-location
// Re-fetches GHL Location API and updates timezone + invoice business details.
// ---------------------------------------------------------------------------
async function syncLocation(req, res) {
  const locationId = req.user.locationId;

  try {
    const client = await getGhlClient(locationId);
    const { data } = await client.get(`/locations/${locationId}`);
    const loc = data?.location ?? data ?? {};

    const tz = loc.timezone ?? null;
    const address = (loc.address || loc.city) ? {
      addressLine1: loc.address    ?? null,
      city:         loc.city       ?? null,
      state:        loc.state      ?? null,
      postalCode:   loc.postalCode ?? loc.postal_code ?? null,
      countryCode:  loc.country    ?? loc.countryCode ?? null,
    } : null;

    const updates = {
      location_id: locationId,
      is_active:   true,
      updated_at:  new Date().toISOString(),
      ...(tz          ? { timezone: tz }                                          : {}),
      ...(loc.name    ? { company_name: loc.name, invoice_business_name: loc.name } : {}),
      ...(loc.logoUrl ? { invoice_business_logo_url: loc.logoUrl }               : {}),
      ...(loc.phone   ? { invoice_business_phone:    loc.phone }                 : {}),
      ...(loc.website ? { invoice_business_website:  loc.website }               : {}),
      ...(address     ? { invoice_business_address:  address }                   : {}),
    };

    const { error } = await supabase
      .from('mh_pwa_tenants')
      .upsert(updates, { onConflict: 'location_id' });

    if (error) {
      logger.error(`syncLocation DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to save location data' });
    }

    logger.info(`syncLocation: upserted location=${locationId} name="${loc.name}" tz="${tz}"`);
    logActivity('admin', 'sync_location', { userId: req.user.userId, locationId });
    return res.json({ ok: true, name: loc.name ?? null, timezone: tz });
  } catch (err) {
    logger.error(`syncLocation error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to sync location' });
  }
}

// ---------------------------------------------------------------------------
// syncStages — POST /api/admin/sync-stages
// Re-fetches pipeline stages from GHL and upserts into mh_pwa_pipeline_stages.
// Preserves existing job_status mappings.
// ---------------------------------------------------------------------------
async function syncStages(req, res) {
  const locationId = req.user.locationId;

  try {
    const { data: tenant } = await supabase
      .from('mh_pwa_tenants')
      .select('pipeline_id')
      .eq('location_id', locationId)
      .maybeSingle();

    if (!tenant?.pipeline_id) {
      return res.status(400).json({ error: 'No pipeline selected. Set pipeline first.' });
    }

    const pipelineId = tenant.pipeline_id;
    const client = await getGhlClient(locationId);
    const { data: ghlData } = await client.get('/opportunities/pipelines', {
      params: { locationId },
    });

    const pipeline = (ghlData?.pipelines ?? []).find((p) => p.id === pipelineId);
    if (!pipeline?.stages?.length) {
      return res.json({ ok: true, synced: 0 });
    }

    const upsertRows = pipeline.stages.map((stage) => ({
      location_id: locationId,
      pipeline_id: pipelineId,
      stage_id:    stage.id,
      stage_name:  stage.name,
      sort_order:  stage.position ?? null,
      updated_at:  new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('mh_pwa_pipeline_stages')
      .upsert(upsertRows, { onConflict: 'location_id,stage_id', ignoreDuplicates: false });

    if (error) {
      logger.error(`syncStages upsert error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to sync stages' });
    }

    logger.info(`syncStages: synced ${upsertRows.length} stages for location=${locationId} pipeline=${pipelineId}`);
    logActivity('admin', 'sync_stages', { userId: req.user.userId, locationId, pipelineId, synced: upsertRows.length });
    return res.json({ ok: true, synced: upsertRows.length });
  } catch (err) {
    logger.error(`syncStages error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to sync stages' });
  }
}

// ---------------------------------------------------------------------------
// updateInvoiceSettings — PATCH /api/admin/invoice-settings
// Body: { taxEnabled, taxName, taxRate, taxCalculation }
// ---------------------------------------------------------------------------
async function updateInvoiceSettings(req, res) {
  const locationId = req.user.locationId;
  const { taxEnabled, taxName, taxRate, taxCalculation, showEstimates } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (taxEnabled     !== undefined) updates.invoice_taxes_enabled     = Boolean(taxEnabled);
  if (taxName        !== undefined) updates.invoice_tax_name          = String(taxName).trim();
  if (taxRate        !== undefined) updates.invoice_tax_rate          = Number(taxRate);
  if (taxCalculation !== undefined) updates.invoice_tax_calculation   = String(taxCalculation);
  if (showEstimates  !== undefined) updates.invoice_show_estimates    = Boolean(showEstimates);

  try {
    const { error } = await supabase
      .from('mh_pwa_tenants')
      .update(updates)
      .eq('location_id', locationId);

    if (error) {
      logger.error(`updateInvoiceSettings DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to save invoice settings' });
    }

    logActivity('admin', 'invoice_settings_updated', { userId: req.user.userId, locationId, updates });
    logger.info(`updateInvoiceSettings: updated location=${locationId}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(`updateInvoiceSettings error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to save invoice settings' });
  }
}

// ---------------------------------------------------------------------------
// getInvoiceSettings — GET /api/admin/invoice-settings
// Returns invoice tax config for this location. Accessible to all auth users
// (crew needs it on the CreateInvoicePage).
// ---------------------------------------------------------------------------
async function getInvoiceSettings(req, res) {
  const locationId = req.user.locationId;

  try {
    const { data: tenant, error } = await supabase
      .from('mh_pwa_tenants')
      .select('invoice_taxes_enabled, invoice_tax_name, invoice_tax_rate, invoice_tax_calculation, invoice_show_estimates')
      .eq('location_id', locationId)
      .maybeSingle();

    if (error) {
      logger.error(`getInvoiceSettings DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch invoice settings' });
    }

    return res.json({
      taxEnabled:     tenant?.invoice_taxes_enabled   ?? false,
      taxName:        tenant?.invoice_tax_name        ?? 'Tax',
      taxRate:        Number(tenant?.invoice_tax_rate ?? 0),
      taxCalculation: tenant?.invoice_tax_calculation ?? 'exclusive',
      showEstimates:  tenant?.invoice_show_estimates  ?? false,
    });
  } catch (err) {
    logger.error(`getInvoiceSettings error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch invoice settings' });
  }
}

// ---------------------------------------------------------------------------
// getNotificationSettings — GET /api/admin/notification-settings
// Returns the per-tenant notification toggle flags.
// ---------------------------------------------------------------------------
async function getNotificationSettings(req, res) {
  const locationId = req.user.locationId;

  try {
    const { data: tenant, error } = await supabase
      .from('mh_pwa_tenants')
      .select([
        'notif_crew_job_assigned',
        'notif_admin_status_changed',
        'notif_admin_invoice_created',
        'notif_admin_invoice_sent',
        'notif_admin_invoice_deleted',
      ].join(', '))
      .eq('location_id', locationId)
      .maybeSingle();

    if (error) {
      logger.error(`getNotificationSettings DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch notification settings' });
    }

    return res.json({
      crewJobAssigned:     tenant?.notif_crew_job_assigned     ?? true,
      adminStatusChanged:  tenant?.notif_admin_status_changed  ?? true,
      adminInvoiceCreated: tenant?.notif_admin_invoice_created ?? true,
      adminInvoiceSent:    tenant?.notif_admin_invoice_sent    ?? true,
      adminInvoiceDeleted: tenant?.notif_admin_invoice_deleted ?? true,
    });
  } catch (err) {
    logger.error(`getNotificationSettings error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
}

// ---------------------------------------------------------------------------
// updateNotificationSettings — PATCH /api/admin/notification-settings
// Body: { crewJobAssigned?, adminStatusChanged?, adminInvoiceCreated?, adminInvoiceSent?, adminInvoiceDeleted? }
// ---------------------------------------------------------------------------
async function updateNotificationSettings(req, res) {
  const locationId = req.user.locationId;
  const {
    crewJobAssigned,
    adminStatusChanged,
    adminInvoiceCreated,
    adminInvoiceSent,
    adminInvoiceDeleted,
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (crewJobAssigned     !== undefined) updates.notif_crew_job_assigned     = Boolean(crewJobAssigned);
  if (adminStatusChanged  !== undefined) updates.notif_admin_status_changed  = Boolean(adminStatusChanged);
  if (adminInvoiceCreated !== undefined) updates.notif_admin_invoice_created = Boolean(adminInvoiceCreated);
  if (adminInvoiceSent    !== undefined) updates.notif_admin_invoice_sent    = Boolean(adminInvoiceSent);
  if (adminInvoiceDeleted !== undefined) updates.notif_admin_invoice_deleted = Boolean(adminInvoiceDeleted);

  try {
    const { error } = await supabase
      .from('mh_pwa_tenants')
      .update(updates)
      .eq('location_id', locationId);

    if (error) {
      logger.error(`updateNotificationSettings DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to save notification settings' });
    }

    logActivity('admin', 'notification_settings_updated', { userId: req.user.userId, locationId, updates });
    return res.json({ ok: true });
  } catch (err) {
    logger.error(`updateNotificationSettings error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to save notification settings' });
  }
}

// ---------------------------------------------------------------------------
// syncCrew — POST /api/admin/sync-crew
// Re-fetches all GHL users for this location and upserts them as crew members.
// Safe to run any time — preserves existing pins and manual field edits.
// ---------------------------------------------------------------------------
async function syncCrew(req, res) {
  const locationId = req.user.locationId;

  try {
    const client = await getGhlClient(locationId);
    const { data: userData } = await client.get('/users/', { params: { locationId } });
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
      return res.json({ ok: true, synced: 0 });
    }

    const { error } = await supabase
      .from('mh_pwa_crew_users')
      .upsert(crewRows, { onConflict: 'ghl_user_id' });

    if (error) {
      logger.error(`syncCrew upsert error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to sync crew' });
    }

    logger.info(`syncCrew: upserted ${crewRows.length} crew members for location=${locationId}`);
    logActivity('admin', 'sync_crew', { userId: req.user.userId, locationId, synced: crewRows.length });
    return res.json({ ok: true, synced: crewRows.length });
  } catch (err) {
    logger.error(`syncCrew error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to sync crew' });
  }
}

// ---------------------------------------------------------------------------
// getCrewLocations — GET /api/admin/crew-locations
// Returns the last known location per driver per active job for this tenant.
// "Active" means job status in (enroute, arrived, in_progress).
// Locations are captured automatically on each status change in the PWA.
// ---------------------------------------------------------------------------
async function getCrewLocations(req, res) {
  const locationId = req.user.locationId;

  try {
    // 1. Active jobs for this tenant
    const { data: activeJobs, error: jobsErr } = await supabase
      .from('mh_pwa_jobs')
      .select('id, customer_name, status, pickup_address')
      .eq('location_id', locationId)
      .in('status', ['enroute', 'arrived', 'in_progress']);

    if (jobsErr) throw jobsErr;
    if (!activeJobs?.length) return res.json({ drivers: [] });

    const jobIds  = activeJobs.map((j) => j.id);
    const jobMap  = Object.fromEntries(activeJobs.map((j) => [j.id, j]));

    // 2. All location pings for those jobs, latest first
    const { data: locations, error: locErr } = await supabase
      .from('mh_pwa_job_locations')
      .select('job_id, crew_user_id, latitude, longitude, accuracy, trigger_event, timestamp')
      .in('job_id', jobIds)
      .order('timestamp', { ascending: false });

    if (locErr) throw locErr;
    if (!locations?.length) return res.json({ drivers: [] });

    // 3. Crew names
    const crewIds = [...new Set(locations.map((l) => l.crew_user_id))];
    const { data: crew, error: crewErr } = await supabase
      .from('mh_pwa_crew_users')
      .select('id, full_name')
      .in('id', crewIds);

    if (crewErr) throw crewErr;
    const crewMap = Object.fromEntries((crew ?? []).map((c) => [c.id, c.full_name]));

    // 4. Keep only the latest ping per driver+job
    const seen    = new Set();
    const drivers = [];
    for (const loc of locations) {
      const key = `${loc.crew_user_id}_${loc.job_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const job = jobMap[loc.job_id];
      drivers.push({
        crewId:        loc.crew_user_id,
        crewName:      crewMap[loc.crew_user_id] ?? 'Unknown',
        jobId:         loc.job_id,
        customerName:  job?.customer_name  ?? '',
        jobStatus:     job?.status         ?? '',
        pickupAddress: job?.pickup_address ?? '',
        lat:           loc.latitude,
        lng:           loc.longitude,
        accuracy:      loc.accuracy,
        triggerEvent:  loc.trigger_event,
        timestamp:     loc.timestamp,
      });
    }

    return res.json({ drivers });
  } catch (err) {
    logger.error(`getCrewLocations error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch crew locations' });
  }
}

// ---------------------------------------------------------------------------
// getBillingRules — GET /api/admin/billing-rules
// Returns the per-tenant billing rules config. Accessible to all auth users
// (crew needs billing_rules_enabled + callout_minutes on CreateInvoicePage).
// ---------------------------------------------------------------------------
async function getBillingRules(req, res) {
  const locationId = req.user.locationId;

  try {
    const { data: tenant, error } = await supabase
      .from('mh_pwa_tenants')
      .select('billing_rules_enabled, billing_callout_minutes, invoice_partial_payment_enabled, billing_minimum_charge_enabled, billing_minimum_charge_amount')
      .eq('location_id', locationId)
      .maybeSingle();

    if (error) {
      logger.error(`getBillingRules DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch billing rules' });
    }

    return res.json({
      billingRulesEnabled:      tenant?.billing_rules_enabled            ?? false,
      calloutMinutes:           tenant?.billing_callout_minutes          ?? 30,
      partialPaymentEnabled:    tenant?.invoice_partial_payment_enabled  ?? false,
      minimumChargeEnabled:     tenant?.billing_minimum_charge_enabled   ?? false,
      minimumChargeAmount:      Number(tenant?.billing_minimum_charge_amount ?? 0),
    });
  } catch (err) {
    logger.error(`getBillingRules error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch billing rules' });
  }
}

// ---------------------------------------------------------------------------
// updateBillingRules — PATCH /api/admin/billing-rules
// Body: { billingRulesEnabled?, calloutMinutes?, partialPaymentEnabled? }
// ---------------------------------------------------------------------------
async function updateBillingRules(req, res) {
  const locationId = req.user.locationId;
  const { billingRulesEnabled, calloutMinutes, partialPaymentEnabled, minimumChargeEnabled, minimumChargeAmount } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (billingRulesEnabled   !== undefined) updates.billing_rules_enabled           = Boolean(billingRulesEnabled);
  if (calloutMinutes        !== undefined) updates.billing_callout_minutes          = Number(calloutMinutes);
  if (partialPaymentEnabled !== undefined) updates.invoice_partial_payment_enabled  = Boolean(partialPaymentEnabled);
  if (minimumChargeEnabled  !== undefined) updates.billing_minimum_charge_enabled   = Boolean(minimumChargeEnabled);
  if (minimumChargeAmount   !== undefined) updates.billing_minimum_charge_amount    = Number(minimumChargeAmount);

  if (Object.keys(updates).length === 1) {
    return res.status(422).json({ error: 'No valid fields provided' });
  }

  try {
    const { error } = await supabase
      .from('mh_pwa_tenants')
      .update(updates)
      .eq('location_id', locationId);

    if (error) {
      logger.error(`updateBillingRules DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to save billing rules' });
    }

    logActivity('admin', 'billing_rules_updated', { userId: req.user.userId, locationId, updates });
    logger.info(`updateBillingRules: updated location=${locationId}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(`updateBillingRules error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to save billing rules' });
  }
}

// ---------------------------------------------------------------------------
// getActivityLog — GET /api/admin/activity
// Returns the most recent activity log entries for this location, with crew
// member names resolved from mh_pwa_crew_users.
// ---------------------------------------------------------------------------
async function getActivityLog(req, res) {
  const locationId = req.user.locationId;
  const limit  = Math.min(parseInt(req.query.limit  ?? 50, 10), 200);
  const offset = parseInt(req.query.offset ?? 0, 10);

  try {
    // Parse ACTIVITY_LOG_SHOW allowlist — comma-separated "category" or "category.action" tokens.
    // If unset/empty, all entries are shown.
    const showTokens = (process.env.ACTIVITY_LOG_SHOW ?? '')
      .split(',').map((t) => t.trim()).filter(Boolean);

    // Fetch entries for this location AND entries with no location_id (legacy / missing JWT location)
    // Fetch a larger batch so JS-side filtering still returns enough results for the requested page.
    const fetchLimit = showTokens.length ? Math.min((limit + offset) * 5, 1000) : limit;

    const { data: rawRows, error } = await supabase
      .from('mh_pwa_activity_log')
      .select('id, category, action, level, meta, user_id, location_id, created_at')
      .or(`location_id.eq.${locationId},location_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    // Apply allowlist filter in JS — exact match for "category.action" pairs,
    // wildcard match for bare "category" tokens.
    const rows = showTokens.length
      ? (rawRows ?? []).filter((r) =>
          showTokens.some((t) =>
            t.includes('.')
              ? t === `${r.category}.${r.action}`
              : t === r.category
          )
        ).slice(offset, offset + limit)
      : (rawRows ?? []).slice(offset, offset + limit);

    if (error) {
      logger.error(`getActivityLog DB error location=${locationId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch activity log' });
    }


    // Resolve user names for any user_id present
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))];
    let nameMap = {};
    if (userIds.length) {
      const { data: crew } = await supabase
        .from('mh_pwa_crew_users')
        .select('id, full_name')
        .in('id', userIds);
      nameMap = Object.fromEntries((crew ?? []).map((c) => [c.id, c.full_name]));
    }

    const entries = (rows ?? []).map((r) => ({
      id:         r.id,
      category:   r.category,
      action:     r.action,
      level:      r.level,
      meta:       r.meta,
      userId:     r.user_id,
      locationId: r.location_id,
      userName:   r.user_id ? (nameMap[r.user_id] ?? null) : null,
      createdAt:  r.created_at,
    }));

    return res.json({ entries, limit, offset });
  } catch (err) {
    logger.error(`getActivityLog error location=${locationId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch activity log' });
  }
}

module.exports = {
  requireAdmin,
  getPipelines,
  setPipeline,
  getStages,
  setStages,
  getCrew,
  updateCrewMember,
  syncJobs,
  refreshFields,
  provisionFields,
  getJobs,
  syncLocation,
  syncStages,
  syncCrew,
  getInvoiceSettings,
  updateInvoiceSettings,
  getNotificationSettings,
  updateNotificationSettings,
  getCrewLocations,
  getBillingRules,
  updateBillingRules,
  getAdminJobEstimates,
  getActivityLog,
};
