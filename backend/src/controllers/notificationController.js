'use strict';

const supabase = require('../services/supabase');
const { VAPID_PUBLIC_KEY } = require('../services/pushService');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// getVapidPublicKey — GET /api/notifications/vapid-key
// Returns the VAPID public key so the frontend can subscribe.
// ---------------------------------------------------------------------------
async function getVapidPublicKey(req, res) {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured on this server' });
  }
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
}

// ---------------------------------------------------------------------------
// subscribe — POST /api/notifications/subscribe
// Body: { endpoint, p256dh, auth }
// Stores a push subscription for the authenticated user.
// ---------------------------------------------------------------------------
async function subscribe(req, res) {
  const userId     = req.user.userId;
  const locationId = req.user.locationId;
  const { endpoint, p256dh, auth } = req.body;

  if (!endpoint || !p256dh || !auth) {
    return res.status(422).json({ error: 'endpoint, p256dh, and auth are required' });
  }

  try {
    const { error } = await supabase
      .from('mh_pwa_push_subscriptions')
      .upsert(
        { user_id: userId, location_id: locationId, endpoint, p256dh, auth },
        { onConflict: 'user_id,endpoint', ignoreDuplicates: false }
      );

    if (error) {
      logger.error(`subscribe: DB error user=${userId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    logger.info(`Push subscription saved for user=${userId} location=${locationId}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(`subscribe unexpected error user=${userId}: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// unsubscribe — DELETE /api/notifications/subscribe
// Body: { endpoint }
// Removes a push subscription for the authenticated user.
// ---------------------------------------------------------------------------
async function unsubscribe(req, res) {
  const userId   = req.user.userId;
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(422).json({ error: 'endpoint is required' });
  }

  try {
    const { error } = await supabase
      .from('mh_pwa_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      logger.error(`unsubscribe: DB error user=${userId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to remove subscription' });
    }

    logger.info(`Push subscription removed for user=${userId}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(`unsubscribe unexpected error user=${userId}: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// getSubscriptionStatus — GET /api/notifications/status
// Returns whether the current user has any subscriptions stored.
// ---------------------------------------------------------------------------
async function getSubscriptionStatus(req, res) {
  const userId = req.user.userId;

  try {
    const { data, error } = await supabase
      .from('mh_pwa_push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      logger.error(`getSubscriptionStatus: DB error user=${userId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to check subscription' });
    }

    return res.json({ subscribed: (data?.length ?? 0) > 0 });
  } catch (err) {
    logger.error(`getSubscriptionStatus unexpected error user=${userId}: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// clearAllSubscriptions — DELETE /api/notifications/subscriptions
// Removes all push subscriptions for the authenticated user (called on logout).
// ---------------------------------------------------------------------------
async function clearAllSubscriptions(req, res) {
  const userId = req.user.userId;

  try {
    const { error } = await supabase
      .from('mh_pwa_push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error(`clearAllSubscriptions: DB error user=${userId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to clear subscriptions' });
    }

    logger.info(`Push subscriptions cleared for user=${userId}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(`clearAllSubscriptions unexpected error user=${userId}: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getVapidPublicKey, subscribe, unsubscribe, getSubscriptionStatus, clearAllSubscriptions };
