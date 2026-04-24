'use strict';

const { Router } = require('express');
const auth = require('../middleware/auth');
const { logLocation, getLocations } = require('../controllers/locationsController');

// mergeParams: true so :jobId from the parent router is available in req.params
const router = Router({ mergeParams: true });

// POST /jobs/:jobId/locations — log a location ping
router.post('/:jobId/locations', auth, logLocation);

// GET  /jobs/:jobId/locations — retrieve last 50 locations for a job
router.get('/:jobId/locations', auth, getLocations);

module.exports = router;
