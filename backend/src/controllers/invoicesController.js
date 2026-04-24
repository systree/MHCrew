'use strict';

const supabase             = require('../services/supabase');
const { getGhlClient }     = require('../services/ghl');
const { retryWithBackoff } = require('../utils/retry');
const logger               = require('../utils/logger');
const { notifyAdmins, getNotificationSettings } = require('../services/pushService');

// ---------------------------------------------------------------------------
// Sync log helper (mirrors ghlOutbound.js pattern)
// ---------------------------------------------------------------------------
async function logOutbound(eventType, payload, status, locationId = null, errorMessage = null) {
  const record = { direction: 'outbound', event_type: eventType, payload, status, location_id: locationId };
  if (errorMessage) record.error_message = errorMessage;
  const { error } = await supabase.from('mh_pwa_ghl_sync_log').insert(record);
  if (error) logger.error(`Failed to write outbound ghl_sync_log [${eventType}]: ${error.message}`);
}

// ---------------------------------------------------------------------------
// getJobInvoices
// GET /api/jobs/:jobId/invoices
// Fetches invoices from GHL for the contact linked to this job.
// Read-only — no create/update from PWA.
// ---------------------------------------------------------------------------
async function getJobInvoices(req, res) {
  const userId     = req.user.userId;
  const locationId = req.user.locationId;
  const { jobId }  = req.params;

  try {
    // Verify assignment + get ghl_contact_id in one query
    const { data: assignment } = await supabase
      .from('mh_pwa_job_crew_assignments')
      .select('job_id')
      .eq('job_id', jobId)
      .eq('crew_user_id', userId)
      .maybeSingle();

    if (!assignment) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    const jobQuery = supabase
      .from('mh_pwa_jobs')
      .select('id, ghl_contact_id')
      .eq('id', jobId);
    if (locationId) jobQuery.eq('location_id', locationId);

    const { data: job, error: jobErr } = await jobQuery.maybeSingle();

    if (jobErr || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.ghl_contact_id) {
      // No contact linked — nothing to fetch
      return res.json({ invoices: [] });
    }

    // Fetch invoices from GHL for this contact
    const client = await getGhlClient(locationId);
    const { data: ghlData } = await client.get('/invoices/', {
      params: {
        altId:     locationId,
        altType:   'location',
        contactId: job.ghl_contact_id,
        limit:     20,
        offset:    '0',
      },
    });

    const raw = ghlData?.invoices ?? ghlData?.data ?? [];
    logger.info(`getJobInvoices: GHL returned ${raw.length} raw invoices for contact=${job.ghl_contact_id}`);

    // Filter out void invoices — not relevant for crew
    const invoices = raw
      .filter((inv) => inv.status !== 'void')
      .map((inv) => ({
        id:            inv._id ?? inv.id,
        invoiceNumber: inv.invoiceNumber ?? inv.number ?? null,
        title:         inv.name ?? inv.title ?? null,
        status:        inv.status,
        total:         inv.total ?? 0,
        amountDue:     inv.amountDue ?? inv.amount_due ?? 0,
        issueDate:     inv.issueDate ?? inv.issue_date ?? null,
        dueDate:       inv.dueDate ?? inv.due_date ?? null,
        lineItems:     (inv.invoiceItems ?? inv.lineItems ?? inv.line_items ?? []).map((li) => ({
          name:      li.name ?? li.description ?? '',
          qty:       li.qty ?? li.quantity ?? 1,
          unitPrice: li.amount ?? li.unitPrice ?? li.unit_price ?? 0,
          total:     (li.qty ?? li.quantity ?? 1) * (li.amount ?? li.unitPrice ?? 0),
        })),
      }))
      .sort((a, b) => new Date(b.issueDate ?? 0) - new Date(a.issueDate ?? 0));

    logger.info(`getJobInvoices: ${invoices.length} invoices for job=${jobId} contact=${job.ghl_contact_id}`);
    return res.json({ invoices });
  } catch (err) {
    // GHL API errors (e.g. 404 contact not found) — return empty rather than 500
    if (err.status === 404) {
      return res.json({ invoices: [] });
    }
    logger.error(`getJobInvoices error job=${jobId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch invoices' });
  }
}

// ---------------------------------------------------------------------------
// createJobInvoice
// POST /api/jobs/:jobId/invoices
// Creates a GHL invoice for the contact linked to this job.
// ---------------------------------------------------------------------------
async function createJobInvoice(req, res) {
  const userId     = req.user.userId;
  const locationId = req.user.locationId;
  const { jobId }  = req.params;
  const { title, items, dueDate } = req.body;

  // Validate body
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(422).json({ error: 'title is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ error: 'At least one line item is required' });
  }
  for (const it of items) {
    if (!it.name || !it.name.trim()) return res.status(422).json({ error: 'Each item must have a name' });
    if (!it.quantity || Number(it.quantity) <= 0) return res.status(422).json({ error: 'Each item must have a valid quantity' });
    if (it.unitPrice === undefined || Number(it.unitPrice) < 0) return res.status(422).json({ error: 'Each item must have a valid unit price' });
  }

  try {
    // Verify assignment + get job
    const { data: assignment } = await supabase
      .from('mh_pwa_job_crew_assignments')
      .select('job_id')
      .eq('job_id', jobId)
      .eq('crew_user_id', userId)
      .maybeSingle();

    if (!assignment) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    const jobQuery = supabase
      .from('mh_pwa_jobs')
      .select('id, ghl_contact_id')
      .eq('id', jobId);
    if (locationId) jobQuery.eq('location_id', locationId);

    const { data: job, error: jobErr } = await jobQuery.maybeSingle();
    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });
    if (!job.ghl_contact_id) return res.status(422).json({ error: 'No contact linked to this job' });

    const client = await getGhlClient(locationId);

    // Parallel: fetch GHL contact, generate invoice number, load tenant settings, get crew GHL user ID
    const [contactRes, invoiceNumberRes, tenantRes, crewUserRes] = await Promise.all([
      client.get(`/contacts/${job.ghl_contact_id}`),
      client.get('/invoices/generate-invoice-number', {
        params: { altId: locationId, altType: 'location' },
      }),
      supabase
        .from('mh_pwa_tenants')
        .select([
          'company_name',
          'invoice_number_prefix',
          'invoice_business_name',
          'invoice_business_logo_url',
          'invoice_business_phone',
          'invoice_business_website',
          'invoice_business_address',
          'invoice_taxes_enabled',
          'invoice_tax_name',
          'invoice_tax_rate',
          'invoice_tax_calculation',
        ].join(', '))
        .eq('location_id', locationId)
        .maybeSingle(),
      supabase
        .from('mh_pwa_crew_users')
        .select('ghl_user_id')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    const contact = contactRes.data?.contact ?? contactRes.data ?? {};
    const invoiceNumber = invoiceNumberRes.data?.invoiceNumber
      ?? invoiceNumberRes.data?.number
      ?? invoiceNumberRes.data
      ?? null;
    const tenant      = tenantRes.data ?? {};
    const ghlUserId   = crewUserRes.data?.ghl_user_id ?? null;

    // Build contactDetails — fall back to job.customer_name if GHL contact has no name
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
      || contact.name
      || job.customer_name
      || 'Customer';
    const contactDetails = {
      id:      job.ghl_contact_id,
      name:    contactName,
      email:   contact.email ?? null,
      phoneNo: contact.phone ?? null,
      ...(contact.companyName ? { companyName: contact.companyName } : {}),
      ...(contact.address1 ? {
        address: {
          addressLine1: contact.address1   ?? null,
          addressLine2: contact.address2   ?? null,
          city:         contact.city       ?? null,
          state:        contact.state      ?? null,
          countryCode:  contact.country    ?? null,
          postalCode:   contact.postalCode ?? null,
        },
      } : {}),
    };

    // Build businessDetails — always include; fall back to tenant company_name
    const bizName = tenant.invoice_business_name ?? tenant.company_name ?? null;
    const businessDetails = bizName ? {
      name:    bizName,
      ...(tenant.invoice_business_logo_url ? { logoUrl: tenant.invoice_business_logo_url } : {}),
      ...(tenant.invoice_business_phone    ? { phoneNo: tenant.invoice_business_phone }    : {}),
      ...(tenant.invoice_business_website  ? { website: tenant.invoice_business_website }  : {}),
      ...(tenant.invoice_business_address  ? { address: tenant.invoice_business_address }  : {}),
    } : undefined;

    // Build tax entry for line items (when enabled)
    const taxEntry = tenant.invoice_taxes_enabled ? [{
      _id:         '63310dYAHOOb472b0d4',
      name:        tenant.invoice_tax_name        ?? 'Tax',
      rate:        Number(tenant.invoice_tax_rate ?? 0),
      calculation: tenant.invoice_tax_calculation ?? 'exclusive',
      description: tenant.invoice_tax_name        ?? 'Tax',
    }] : [];

    const issueDate = new Date().toISOString().slice(0, 10);
    const prefix    = tenant.invoice_number_prefix ?? 'INV-';

    const payload = {
      altId:   locationId,
      altType: 'location',
      name:    title.trim(),
      title:   title.trim(),
      contactDetails,
      issueDate,
      ...(dueDate         ? { dueDate }                                                        : {}),
      ...(invoiceNumber   ? { invoiceNumber: String(invoiceNumber), invoiceNumberPrefix: prefix } : {}),
      ...(businessDetails ? { businessDetails }                                                 : {}),
      currency:               'AUD',
      liveMode:               true,
      automaticTaxesEnabled:  false,
      paymentMethods:         { stripe: { enableBankDebitOnly: false } },
      items: items.map((it) => ({
        name:     it.name.trim(),
        qty:      Number(it.quantity),
        amount:   Number(it.unitPrice),
        currency: 'AUD',
        ...(taxEntry.length ? { taxes: taxEntry } : {}),
      })),
    };

    logger.info(`createJobInvoice payload: ${JSON.stringify(payload, null, 2)}`);
    const { data: ghlData } = await retryWithBackoff(() => client.post('/invoices/', payload));

    const createdInvoiceId = ghlData?.invoice?._id ?? ghlData?.invoice?.id ?? ghlData?._id ?? null;
    await logOutbound('invoice.create', { jobId, locationId, contactId: job.ghl_contact_id }, 'success', locationId);
    logger.info(`createJobInvoice: created invoice=${createdInvoiceId} for job=${jobId} contact=${job.ghl_contact_id}`);

    // Immediately send the invoice — crew should never have to do this as a separate step
    if (createdInvoiceId) {
      const sendPayload = {
        altId:    locationId,
        altType:  'location',
        action:   'sms_and_email',
        liveMode: true,
        ...(ghlUserId ? { userId: ghlUserId } : {}),
      };
      try {
        await retryWithBackoff(() => client.post(`/invoices/${createdInvoiceId}/send`, sendPayload));
        await logOutbound('invoice.send', { jobId, invoiceId: createdInvoiceId, locationId }, 'success', locationId);
        logger.info(`createJobInvoice: auto-sent invoice=${createdInvoiceId} for job=${jobId}`);
      } catch (sendErr) {
        // Log but don't fail the request — invoice was created, send failed
        await logOutbound('invoice.send', { jobId, invoiceId: createdInvoiceId, locationId }, 'failed', locationId, sendErr.message);
        logger.error(`createJobInvoice: auto-send failed for invoice=${createdInvoiceId}: ${sendErr.message}`);
      }
    }

    // Push notification to admins (fire-and-forget)
    if (locationId) {
      (async () => {
        try {
          const settings = await getNotificationSettings(locationId);
          if (settings.adminInvoiceCreated) {
            const { data: actor } = await supabase
              .from('mh_pwa_crew_users')
              .select('full_name')
              .eq('id', userId)
              .maybeSingle();
            const crewName = actor?.full_name ?? 'A crew member';
            await notifyAdmins(locationId, {
              title: 'Invoice Created',
              body:  `${crewName} created invoice "${title.trim()}"`,
              url:   `/admin/jobs`,
              tag:   `invoice-create-${jobId}`,
            });
          }
        } catch (err) {
          logger.error(`Invoice create push notification failed: ${err.message}`);
        }
      })();
    }

    const inv = ghlData?.invoice ?? ghlData ?? {};
    return res.status(201).json({
      invoice: {
        id:            inv._id ?? inv.id,
        invoiceNumber: inv.invoiceNumber ?? inv.number ?? null,
        title:         inv.name ?? inv.title ?? title,
        status:        inv.status ?? 'draft',
        total:         inv.total ?? 0,
        amountDue:     inv.amountDue ?? inv.amount_due ?? 0,
        issueDate:     inv.issueDate ?? issueDate,
        dueDate:       inv.dueDate ?? dueDate ?? null,
        lineItems:     (inv.items ?? inv.invoiceItems ?? inv.lineItems ?? []).map((li) => ({
          name:      li.name ?? li.description ?? '',
          qty:       li.qty ?? li.quantity ?? 1,
          unitPrice: li.amount ?? li.unitPrice ?? li.unit_price ?? 0,
          total:     (li.qty ?? li.quantity ?? 1) * (li.amount ?? li.unitPrice ?? 0),
        })),
      },
    });
  } catch (err) {
    await logOutbound('invoice.create', { jobId, locationId }, 'failed', locationId, err.message);
    logger.error(`createJobInvoice error job=${jobId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to create invoice' });
  }
}

// ---------------------------------------------------------------------------
// sendJobInvoice
// POST /api/jobs/:jobId/invoices/:invoiceId/send
// Sends a GHL invoice to the client.
// ---------------------------------------------------------------------------
async function sendJobInvoice(req, res) {
  const userId      = req.user.userId;
  const locationId  = req.user.locationId;
  const { jobId, invoiceId } = req.params;

  try {
    // Verify assignment + fetch crew user's GHL user ID in parallel
    const [assignmentRes, crewUserRes] = await Promise.all([
      supabase
        .from('mh_pwa_job_crew_assignments')
        .select('job_id')
        .eq('job_id', jobId)
        .eq('crew_user_id', userId)
        .maybeSingle(),
      supabase
        .from('mh_pwa_crew_users')
        .select('ghl_user_id')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    if (!assignmentRes.data) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    const ghlUserId = crewUserRes.data?.ghl_user_id ?? null;

    const client = await getGhlClient(locationId);
    const sendPayload = {
      altId:    locationId,
      altType:  'location',
      action:   'sms_and_email',
      liveMode: true,
      ...(ghlUserId ? { userId: ghlUserId } : {}),
    };
    await retryWithBackoff(() =>
      client.post(`/invoices/${invoiceId}/send`, sendPayload)
    );

    await logOutbound('invoice.send', { jobId, invoiceId, locationId }, 'success', locationId);
    logger.info(`sendJobInvoice: sent invoice=${invoiceId} for job=${jobId}`);

    // Push notification to admins (fire-and-forget)
    if (locationId) {
      (async () => {
        try {
          const settings = await getNotificationSettings(locationId);
          if (settings.adminInvoiceSent) {
            const { data: actor } = await supabase
              .from('mh_pwa_crew_users')
              .select('full_name')
              .eq('id', userId)
              .maybeSingle();
            const crewName = actor?.full_name ?? 'A crew member';
            await notifyAdmins(locationId, {
              title: 'Invoice Sent',
              body:  `${crewName} sent an invoice to the client`,
              url:   `/admin/jobs`,
              tag:   `invoice-send-${invoiceId}`,
            });
          }
        } catch (err) {
          logger.error(`Invoice send push notification failed: ${err.message}`);
        }
      })();
    }

    return res.json({ success: true });
  } catch (err) {
    await logOutbound('invoice.send', { jobId, invoiceId, locationId }, 'failed', locationId, err.message);
    logger.error(`sendJobInvoice error job=${jobId} invoice=${invoiceId}: ${err.message}`);
    return res.status(500).json({ error: 'Failed to send invoice' });
  }
}

// ---------------------------------------------------------------------------
// deleteJobInvoice
// DELETE /api/jobs/:jobId/invoices/:invoiceId
// Deletes a GHL draft invoice. GHL only allows deleting draft invoices.
// ---------------------------------------------------------------------------
async function deleteJobInvoice(req, res) {
  const userId      = req.user.userId;
  const locationId  = req.user.locationId;
  const { jobId, invoiceId } = req.params;

  try {
    // Verify assignment
    const { data: assignment } = await supabase
      .from('mh_pwa_job_crew_assignments')
      .select('job_id')
      .eq('job_id', jobId)
      .eq('crew_user_id', userId)
      .maybeSingle();

    if (!assignment) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    const client = await getGhlClient(locationId);
    await retryWithBackoff(() =>
      client.delete(`/invoices/${invoiceId}`, {
        params: { altId: locationId, altType: 'location' },
      })
    );

    await logOutbound('invoice.delete', { jobId, invoiceId, locationId }, 'success', locationId);
    logger.info(`deleteJobInvoice: deleted invoice=${invoiceId} for job=${jobId}`);

    // Push notification to admins (fire-and-forget)
    if (locationId) {
      (async () => {
        try {
          const settings = await getNotificationSettings(locationId);
          if (settings.adminInvoiceDeleted) {
            const { data: actor } = await supabase
              .from('mh_pwa_crew_users')
              .select('full_name')
              .eq('id', userId)
              .maybeSingle();
            const crewName = actor?.full_name ?? 'A crew member';
            await notifyAdmins(locationId, {
              title: 'Invoice Deleted',
              body:  `${crewName} deleted a draft invoice`,
              url:   `/admin/jobs`,
              tag:   `invoice-delete-${invoiceId}`,
            });
          }
        } catch (err) {
          logger.error(`Invoice delete push notification failed: ${err.message}`);
        }
      })();
    }

    return res.json({ success: true });
  } catch (err) {
    await logOutbound('invoice.delete', { jobId, invoiceId, locationId }, 'failed', locationId, err.message);
    logger.error(`deleteJobInvoice error job=${jobId} invoice=${invoiceId}: ${err.message}`);

    if (err.status === 400) {
      return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    }
    return res.status(500).json({ error: 'Failed to delete invoice' });
  }
}

module.exports = { getJobInvoices, createJobInvoice, sendJobInvoice, deleteJobInvoice };
