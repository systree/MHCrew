import { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications.js';

// ---------------------------------------------------------------------------
// Storage helpers
// dismissed: { at: timestamp, permanent: bool }
// permanent = true  → user said "Don't ask again" (or granted + subscribed)
// permanent = false → snoozed for SNOOZE_DAYS, then show again
// ---------------------------------------------------------------------------
const STORAGE_KEY  = 'mh_notif_prompt';
const SNOOZE_DAYS  = 7;
const SNOOZE_MS    = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

function getStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isSuppressed() {
  const stored = getStoredState();
  if (!stored) return false;
  if (stored.permanent) return true;
  return Date.now() - stored.at < SNOOZE_MS;
}

function markPermanent() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), permanent: true })); } catch {}
}

function markSnoozed() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), permanent: false })); } catch {}
}

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

// ---------------------------------------------------------------------------
// NotificationPromptCard
//
// Shown once (with snooze) on the Dashboard after first login.
// Handles three states:
//   • iOS in browser tab  — tell user to install first
//   • push not supported  — hide entirely
//   • supported           — show Enable / Not Now
// ---------------------------------------------------------------------------
export default function NotificationPromptCard() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [needsInstall, setNeedsInstall] = useState(false);

  const {
    supported,
    permission,
    subscribed,
    loading,
    error,
    subscribe,
  } = usePushNotifications();

  useEffect(() => {
    // Already subscribed or permanently dismissed — never show
    if (subscribed || isSuppressed()) return;

    const plat = detectPlatform();
    setPlatform(plat);

    if (!supported) return; // push not supported on this device/browser at all

    if (permission === 'denied') {
      // User blocked at OS level — nothing we can do, hide
      return;
    }

    if (plat === 'ios' && !isInstalled()) {
      // iOS in browser tab — push won't work; show install nudge instead
      setNeedsInstall(true);
      setShow(true);
      return;
    }

    // Android/desktop/iOS-installed — show the enable prompt
    setShow(true);
  }, [supported, permission, subscribed]);

  if (!show) return null;

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      // Successfully subscribed — never ask again
      markPermanent();
      setShow(false);
    }
    // On failure: keep card visible so user can see the error and retry
  };

  const handleDismiss = () => {
    markSnoozed();
    setShow(false);
  };

  const handleNeverAsk = () => {
    markPermanent();
    setShow(false);
  };

  // ---- iOS needs-install variant ----
  if (needsInstall) {
    return (
      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          {bellIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={titleStyle}>Enable Push Notifications</p>
          <p style={bodyStyle}>
            Add this app to your Home Screen first, then open it from there to enable push notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          style={closeStyle}
          aria-label="Dismiss"
        >
          {closeIcon}
        </button>
      </div>
    );
  }

  // ---- Standard enable prompt ----
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={iconWrapStyle}>
          {bellIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={titleStyle}>Enable Push Notifications</p>
          <p style={bodyStyle}>
            Get notified instantly when a job is assigned to you — even when the app is closed.
          </p>
          {error && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#f87171', marginTop: 6 }}>{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          style={closeStyle}
          aria-label="Dismiss"
        >
          {closeIcon}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 2, padding: '10px 0' }}
          onClick={handleEnable}
          disabled={loading}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Enabling…
            </span>
          ) : 'Enable Notifications'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ flex: 1, padding: '10px 0' }}
          onClick={handleNeverAsk}
        >
          Not Now
        </button>
      </div>
    </div>
  );
}

/* ---- Styles ---- */

const cardStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid rgba(233,69,96,0.25)',
  borderRadius: 'var(--radius-lg)',
  padding: 16,
  boxShadow: '0 0 0 1px rgba(233,69,96,0.08), 0 4px 16px rgba(0,0,0,0.2)',
};

const iconWrapStyle = {
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-md)',
  background: 'rgba(233,69,96,0.12)',
  border: '1px solid rgba(233,69,96,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-primary)',
  flexShrink: 0,
};

const titleStyle = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 700,
  color: 'var(--color-text)',
  marginBottom: 4,
};

const bodyStyle = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-muted)',
  lineHeight: 1.5,
};

const closeStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
};

const bellIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const closeIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
