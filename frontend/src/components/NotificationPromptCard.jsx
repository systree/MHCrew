import { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications.js';

// ---------------------------------------------------------------------------
// Storage helpers
// Only written on successful subscribe — prevents re-showing on next session
// when the user is already subscribed but the hook hasn't resolved yet.
// Never written on dismiss (no permanent "don't ask again").
// ---------------------------------------------------------------------------
const SUBSCRIBED_KEY = 'mh_notif_subscribed';

function isSubscribedPermanent() {
  try { return localStorage.getItem(SUBSCRIBED_KEY) === '1'; } catch { return false; }
}

function markPermanent() {
  try { localStorage.setItem(SUBSCRIBED_KEY, '1'); } catch {}
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
    // Already subscribed (hook state or localStorage fast-path) — never show
    if (subscribed || isSubscribedPermanent()) return;
    // Session-level snooze — user clicked "Later" this session
    if (sessionStorage.getItem('mh_notif_snoozed') === '1') return;

    const plat = detectPlatform();
    setPlatform(plat);

    if (!supported) return;

    if (plat === 'ios' && !isInstalled()) {
      setNeedsInstall(true);
      setShow(true);
      return;
    }

    // Show for all states including 'denied' — we render different content per state
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

  const handleLater = () => {
    try { sessionStorage.setItem('mh_notif_snoozed', '1'); } catch {}
    setShow(false);
  };

  // ---- iOS needs-install variant ----
  if (needsInstall) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={iconWrapStyle}>{bellIcon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={titleStyle}>Enable Push Notifications</p>
            <p style={bodyStyle}>
              Add this app to your Home Screen first, then open it from there to enable push notifications.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px 0' }} onClick={handleLater}>
            Later
          </button>
        </div>
      </div>
    );
  }

  // ---- OS-level blocked — inform, can't request again ----
  if (permission === 'denied') {
    return (
      <div style={{ ...cardStyle, borderColor: 'rgba(234,179,8,0.3)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ ...iconWrapStyle, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.2)', color: '#facc15' }}>
            {warnIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={titleStyle}>Notifications Blocked</p>
            <p style={bodyStyle}>
              Notifications are blocked in your browser settings. Enable them in your browser site permissions to receive job alerts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Standard enable prompt ----
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={iconWrapStyle}>{bellIcon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={titleStyle}>Enable Push Notifications</p>
          <p style={bodyStyle}>
            Get notified instantly when a job is assigned to you — even when the app is closed.
          </p>
          {error && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#f87171', marginTop: 6 }}>{error}</p>
          )}
        </div>
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
          onClick={handleLater}
        >
          Later
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


const bellIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const warnIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
