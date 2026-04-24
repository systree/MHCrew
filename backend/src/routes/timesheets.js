const { Router } = require('express');
const auth = require('../middleware/auth');
const {
  clockIn,
  clockOut,
  endBreak,
  getTimesheets,
} = require('../controllers/timesheetController');

/**
 * Timesheet routes — all mounted under /jobs/:jobId via the parent router.
 *
 * Because Express does not forward :jobId to child routers by default,
 * we use mergeParams: true so the controller can read req.params.jobId.
 */
const router = Router({ mergeParams: true });

// POST /jobs/:jobId/timesheets/clock-in
router.post('/clock-in', auth, clockIn);

// POST /jobs/:jobId/timesheets/clock-out
router.post('/clock-out', auth, clockOut);

// POST /jobs/:jobId/timesheets/break-end
router.post('/break-end', auth, endBreak);

// GET /jobs/:jobId/timesheets
router.get('/', auth, getTimesheets);

module.exports = router;
