const { Router } = require('express');
const authRouter          = require('./auth');
const jobsRouter          = require('./jobs');
const photosRouter        = require('./photos');
const locationsRouter     = require('./locations');
const adminRouter         = require('./admin');
const notificationsRouter = require('./notifications');

const router = Router();

// Auth routes — /auth/send-otp, /auth/verify-otp, /auth/setup-pin, /auth/login-pin, /auth/me
router.use('/auth', authRouter);

// NOTE: /webhooks is registered in index.js BEFORE express.json() for raw body capture.

// Jobs — GET /jobs, GET /jobs/:id, PATCH /jobs/:id/status
router.use('/jobs', jobsRouter);

// Photo capture — POST/GET /jobs/:jobId/photos, DELETE /jobs/:jobId/photos/:photoId
router.use('/jobs', photosRouter);

// GPS location tracking — POST/GET /jobs/:jobId/locations
router.use('/jobs', locationsRouter);

// Admin utilities — POST /api/admin/refresh-fields/:locationId
router.use('/admin', adminRouter);

// Push notifications — GET /notifications/vapid-key, POST/DELETE /notifications/subscribe
router.use('/notifications', notificationsRouter);

module.exports = router;
