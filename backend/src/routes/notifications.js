'use strict';

const { Router } = require('express');
const auth = require('../middleware/auth');
const {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getSubscriptionStatus,
  clearAllSubscriptions,
} = require('../controllers/notificationController');

const router = Router();

// GET /api/notifications/vapid-key — public, no auth required
router.get('/vapid-key', getVapidPublicKey);

// GET /api/notifications/status — is current user subscribed?
router.get('/status', auth, getSubscriptionStatus);

// POST /api/notifications/subscribe — save push subscription
router.post('/subscribe', auth, subscribe);

// DELETE /api/notifications/subscribe — remove a specific push subscription
router.delete('/subscribe', auth, unsubscribe);

// DELETE /api/notifications/subscriptions — remove ALL subscriptions for user (called on logout)
router.delete('/subscriptions', auth, clearAllSubscriptions);

module.exports = router;
