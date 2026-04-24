'use strict';

const webpush  = require('web-push');
const supabase = require('./supabase');
const logger   = require('../utils/logger');

// ---------------------------------------------------------------------------
// VAPID initialisation
// Keys are generated once via:  npx web-push generate-vapid-keys
// and stored in .env as VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? 'mailto:admin@moverhero.com.au';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  logger.warn('VAPID keys not configured — push notifications are disabled. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in .env');
}

// ---------------------------------------------------------------------------
// sendToSubscription — sends a push notification to a single subscription.
// Returns true on success, false on non-recoverable error, null on 410 (expired).
// ---------------------------------------------------------------------------
async function sendToSubscription(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth:   subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // 24h TTL
    );
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or invalid — caller should delete it
      return null;
    }
    logger.warn(`Push send failed for endpoint=${subscription.endpoint}: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// cleanupExpiredSubscription — removes a gone subscription from the DB.
// ---------------------------------------------------------------------------
async function cleanupExpiredSubscription(subscriptionId) {
  const { error } = await supabase
    .from('mh_pwa_push_subscriptions')
    .delete()
    .eq('id', subscriptionId);

  if (error) {
    logger.warn(`Could not delete expired subscription id=${subscriptionId}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// notifyUser — sends a push to all subscriptions for a single crew user.
// Fire-and-forget safe: errors are logged, never thrown.
// ---------------------------------------------------------------------------
async function notifyUser(userId, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  try {
    const { data: subs, error } = await supabase
      .from('mh_pwa_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) {
      logger.error(`notifyUser: subscription fetch error for user=${userId}: ${error.message}`);
      return;
    }
    if (!subs?.length) return;

    await Promise.allSettled(
      subs.map(async (sub) => {
        const result = await sendToSubscription(sub, payload);
        if (result === null) {
          await cleanupExpiredSubscription(sub.id);
        }
      })
    );
  } catch (err) {
    logger.error(`notifyUser unexpected error user=${userId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// notifyAdmins — sends a push to all admin subscriptions for a tenant.
// Fire-and-forget safe.
// ---------------------------------------------------------------------------
async function notifyAdmins(locationId, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  try {
    // Get all active admin users for this tenant
    const { data: admins, error: adminErr } = await supabase
      .from('mh_pwa_crew_users')
      .select('id')
      .eq('location_id', locationId)
      .eq('role', 'admin')
      .eq('is_active', true);

    if (adminErr) {
      logger.error(`notifyAdmins: admin fetch error for location=${locationId}: ${adminErr.message}`);
      return;
    }
    if (!admins?.length) return;

    const adminIds = admins.map((a) => a.id);

    const { data: subs, error: subErr } = await supabase
      .from('mh_pwa_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', adminIds)
      .eq('location_id', locationId);

    if (subErr) {
      logger.error(`notifyAdmins: subscription fetch error for location=${locationId}: ${subErr.message}`);
      return;
    }
    if (!subs?.length) return;

    await Promise.allSettled(
      subs.map(async (sub) => {
        const result = await sendToSubscription(sub, payload);
        if (result === null) {
          await cleanupExpiredSubscription(sub.id);
        }
      })
    );
  } catch (err) {
    logger.error(`notifyAdmins unexpected error location=${locationId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// getNotificationSettings — fetches tenant's notification toggles.
// Returns all-true defaults if tenant row not found.
// ---------------------------------------------------------------------------
async function getNotificationSettings(locationId) {
  const { data } = await supabase
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

  return {
    crewJobAssigned:     data?.notif_crew_job_assigned     ?? true,
    adminStatusChanged:  data?.notif_admin_status_changed  ?? true,
    adminInvoiceCreated: data?.notif_admin_invoice_created ?? true,
    adminInvoiceSent:    data?.notif_admin_invoice_sent    ?? true,
    adminInvoiceDeleted: data?.notif_admin_invoice_deleted ?? true,
  };
}

module.exports = {
  VAPID_PUBLIC_KEY,
  notifyUser,
  notifyAdmins,
  getNotificationSettings,
};
