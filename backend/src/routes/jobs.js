'use strict';

const { Router } = require('express');
const auth = require('../middleware/auth');
const { getMyJobs, getJobById, updateJobStatus } = require('../controllers/jobsController');
const { getJobInvoices, createJobInvoice, sendJobInvoice, deleteJobInvoice } = require('../controllers/invoicesController');
const timesheetRouter = require('./timesheets');

const router = Router();

// GET /api/jobs — list jobs assigned to the authenticated crew member
router.get('/', auth, getMyJobs);

// GET /api/jobs/:id — fetch a single job (must be assigned to the caller)
router.get('/:id', auth, getJobById);

// PATCH /api/jobs/:id/status — advance or cancel a job's status
router.patch('/:id/status', auth, updateJobStatus);

// GET  /api/jobs/:jobId/invoices — fetch GHL invoices for the job's contact
router.get('/:jobId/invoices', auth, getJobInvoices);

// POST /api/jobs/:jobId/invoices — create a GHL invoice for the job's contact
router.post('/:jobId/invoices', auth, createJobInvoice);

// POST /api/jobs/:jobId/invoices/:invoiceId/send — send a GHL invoice to the client
router.post('/:jobId/invoices/:invoiceId/send', auth, sendJobInvoice);

// DELETE /api/jobs/:jobId/invoices/:invoiceId — delete a draft GHL invoice
router.delete('/:jobId/invoices/:invoiceId', auth, deleteJobInvoice);

// Timesheet routes — POST /api/jobs/:jobId/timesheets/clock-in, etc.
// mergeParams is set on timesheetRouter so it can read :jobId
router.use('/:jobId/timesheets', timesheetRouter);

module.exports = router;
