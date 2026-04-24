import { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

// ---------------------------------------------------------------------------
// usePushNotifications
//
// Manages the full Web Push subscription lifecycle:
//   1. Fetch VAPID public key from the server
//   2. Request notification permission
//   3. Subscribe via PushManager with the VAPID key
//   4. POST the subscription to the backend
//   5. On unsubscribe — DELETE from backend and browser
//
// Returns:
//   { supported, permission, subscribed, loading, error, subscribe, unsubscribe }
// ---------------------------------------------------------------------------
export function usePushNotifications() {
  const [supported,   setSupported]   = useState(false);
  const [permission,  setPermission]  = useState('default');
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Check initial state on mount
  useEffect(() => {
    const isPushSupported =
      'serviceWorker' in navigator &&
      'PushManager'   in window    &&
      'Notification'  in window;

    setSupported(isPushSupported);

    if (!isPushSupported) {
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);

    let mounted = true;

    // Check if already subscribed on this device
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (mounted) {
          setSubscribed(!!sub);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // subscribe — request permission, create push subscription, save to backend
  // ---------------------------------------------------------------------------
  const subscribe = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // 1. Fetch VAPID public key
      const { data: keyData } = await api.get('/notifications/vapid-key');
      const vapidPublicKey = keyData?.publicKey;
      if (!vapidPublicKey) {
        throw new Error('Push notifications are not enabled on this server.');
      }

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        throw new Error('Notification permission denied.');
      }

      // 3. Subscribe via PushManager
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 4. Send subscription to backend
      const subJson = pushSub.toJSON();
      await api.post('/notifications/subscribe', {
        endpoint: subJson.endpoint,
        p256dh:   subJson.keys.p256dh,
        auth:     subJson.keys.auth,
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      setError(err.message ?? 'Failed to enable notifications.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // unsubscribe — remove subscription from browser and backend
  // ---------------------------------------------------------------------------
  const unsubscribe = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.getSubscription();

      if (pushSub) {
        const endpoint = pushSub.endpoint;

        // Remove from browser
        await pushSub.unsubscribe();

        // Remove from backend
        await api.delete('/notifications/subscribe', { data: { endpoint } });
      }

      setSubscribed(false);
    } catch (err) {
      setError(err.message ?? 'Failed to disable notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe };
}

// ---------------------------------------------------------------------------
// Convert a VAPID base64url public key to a Uint8Array for PushManager
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64String) {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = atob(base64);
  const output   = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
