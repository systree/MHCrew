import { useState, useEffect } from 'react';

// Permanent grant record — only written on success so we never flash the card
// when the user has already granted. Never written on dismiss.
const GRANTED_KEY = 'mh_location_granted';

function isGrantedPermanent() {
  try { return localStorage.getItem(GRANTED_KEY) === '1'; } catch { return false; }
}
function markGrantedPermanent() {
  try { localStorage.setItem(GRANTED_KEY, '1'); } catch {}
}

// ---------------------------------------------------------------------------
// LocationPromptCard
//
// Shows on every dashboard session until geolocation is granted.
// "Later" hides for the current tab session only (sessionStorage).
// There is no permanent dismiss — the card re-appears on every app open
// until the driver grants the permission.
//
// States:
//   granted   → mark permanent, never show again
//   denied    → show a "blocked" info banner (can't request again)
//   prompt    → show Enable / Later
// ---------------------------------------------------------------------------
export default function LocationPromptCard() {
  const [state, setState] = useState('loading'); // 'loading'|'granted'|'denied'|'prompt'|'snoozed'
  const [reqError, setReqError] = useState(null);
  const [loading, setLoading]   = useState(false);

  const supported = Boolean(navigator.geolocation);

  useEffect(() => {
    if (!supported) { setState('unavailable'); return; }
    if (isGrantedPermanent()) { setState('granted'); return; }
    if (sessionStorage.getItem('mh_loc_snoozed') === '1') { setState('snoozed'); return; }

    if (!navigator.permissions) {
      setState('prompt');
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted') {
        markGrantedPermanent();
        setState('granted');
        return;
      }
      if (result.state === 'denied') {
        setState('denied');
        return;
      }
      setState('prompt');

      result.onchange = () => {
        if (result.state === 'granted') {
          markGrantedPermanent();
          setState('granted');
        } else if (result.state === 'denied') {
          setState('denied');
        }
      };
    }).catch(() => setState('prompt'));
  }, [supported]);

  // Nothing to show in these states
  if (state === 'loading' || state === 'granted' || state === 'unavailable' || state === 'snoozed') return null;

  // OS-level blocked — we can't request again, inform the driver
  if (state === 'denied') {
    return (
      <div style={{ ...cardStyle, borderColor: 'rgba(234,179,8,0.3)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ ...iconWrapStyle, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.2)', color: '#facc15' }}>
            {warnIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={titleStyle}>Location Access Blocked</p>
            <p style={bodyStyle}>
              Location is blocked in your browser settings. Tap the lock icon in your address bar and allow Location to enable job tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Prompt state — ask for permission
  const handleEnable = () => {
    setLoading(true);
    setReqError(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        markGrantedPermanent();
        setLoading(false);
        setState('granted');
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
        } else {
          setReqError('Could not get location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLater = () => {
    try { sessionStorage.setItem('mh_loc_snoozed', '1'); } catch {}
    setState('snoozed');
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
            Required so the app can record your position when you update a job status — lets the admin see where you are on a map.
          </p>
          {reqError && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#f87171', marginTop: 6 }}>{reqError}</p>
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
          ) : 'Enable Location'}
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

const locationIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

const warnIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
