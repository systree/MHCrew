'use strict';

const { Router } = require('express');
const supabase   = require('../services/supabase');
const logger     = require('../utils/logger');

const requireAuth = require('../middleware/auth');
const {
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
} = require('../controllers/adminController');

const router = Router();

// ---------------------------------------------------------------------------
// JWT-protected admin routes — require authenticated admin user
// ---------------------------------------------------------------------------
router.get('/pipelines',    requireAuth, requireAdmin, getPipelines);
router.post('/pipeline',    requireAuth, requireAdmin, setPipeline);
router.get('/stages',       requireAuth, requireAdmin, getStages);
router.post('/stages',      requireAuth, requireAdmin, setStages);
router.get('/crew',         requireAuth, requireAdmin, getCrew);
router.patch('/crew/:id',   requireAuth, requireAdmin, updateCrewMember);
router.post('/sync-jobs',      requireAuth, requireAdmin, syncJobs);
router.post('/sync-location',  requireAuth, requireAdmin, syncLocation);
router.post('/sync-stages',    requireAuth, requireAdmin, syncStages);
router.post('/sync-crew',      requireAuth, requireAdmin, syncCrew);
router.post('/refresh-fields',   requireAuth, requireAdmin, refreshFields);
router.post('/provision-fields', requireAuth, requireAdmin, provisionFields);
router.get('/jobs',            requireAuth, requireAdmin, getJobs);
router.get('/invoice-settings',   requireAuth,              getInvoiceSettings);
router.patch('/invoice-settings', requireAuth, requireAdmin, updateInvoiceSettings);
router.get('/notification-settings',   requireAuth, requireAdmin, getNotificationSettings);
router.patch('/notification-settings', requireAuth, requireAdmin, updateNotificationSettings);

// ---------------------------------------------------------------------------
// POST /api/admin/refresh-fields/:locationId
// Legacy static-key version — kept for backwards compatibility.
// ---------------------------------------------------------------------------
router.post('/refresh-fields/:locationId', (req, res, next) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}, async (req, res) => {
  const { locationId } = req.params;

  const { error } = await supabase
    .from('mh_pwa_location_custom_fields')
    .delete()
    .eq('location_id', locationId);

  if (error) {
    logger.error(`refresh-fields: DB error for location=${locationId}: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }

  logger.info(`refresh-fields: cleared field cache for location=${locationId}`);
  return res.json({ ok: true, message: `Field cache cleared for ${locationId}. Re-fire any opportunity webhook to rebuild.` });
});

module.exports = router;
