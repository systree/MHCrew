import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Storage helpers — same snooze pattern as NotificationPromptCard
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'mh_location_prompt';
const SNOOZE_DAYS = 7;
const SNOOZE_MS   = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

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

// ---------------------------------------------------------------------------
// LocationPromptCard
//
// Shown once (with snooze) on the Dashboard.
// Handles three states:
//   • not supported     — hide entirely
//   • denied            — hide (nothing we can do)
//   • prompt / granted  — show Enable / Not Now
// ---------------------------------------------------------------------------
export default function LocationPromptCard() {
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const supported = Boolean(navigator.geolocation);

  useEffect(() => {
    if (!supported || isSuppressed()) return;

    if (!navigator.permissions) {
      // Permissions API not available — show the prompt and let the browser decide
      setShow(true);
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted') {
        // Already granted — mark permanent so we never bother the user again
        markPermanent();
        return;
      }
      if (result.state === 'denied') return; // blocked at OS level — nothing to do

      // 'prompt' state — show the card
      setShow(true);

      // React if the user changes permission in browser settings while the page is open
      result.onchange = () => {
        if (result.state === 'granted') {
          markPermanent();
          setShow(false);
        } else if (result.state === 'denied') {
          setShow(false);
        }
      };
    }).catch(() => {
      // Fallback: Permissions API threw — show the prompt anyway
      setShow(true);
    });
  }, [supported]);

  if (!show) return null;

  const handleEnable = () => {
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        markPermanent();
        setLoading(false);
        setShow(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          // User denied — stop asking
          markPermanent();
          setShow(false);
        } else {
          setError('Could not get location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleDismiss = () => {
    markSnoozed();
    setShow(false);
  };

  const handleNeverAsk = () => {
    markPermanent();
    setShow(false);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={iconWrapStyle}>
          {locationIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={titleStyle}>Enable Location Access</p>
          <p style={bodyStyle}>
            Allows the app to show job sites on a map and auto-fill your location when clocking in.
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
          ) : 'Enable Location'}
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

const locationIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

const closeIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
