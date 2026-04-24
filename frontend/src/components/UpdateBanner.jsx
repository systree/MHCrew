import { useState, useEffect } from 'react';

/**
 * UpdateBanner
 *
 * Fixed banner above the bottom nav that appears when a new service worker
 * has taken control (i.e. a new app version was deployed and is now active).
 * Tapping "Refresh" reloads the page so the new JS is loaded.
 *
 * The 'sw-updated' CustomEvent is dispatched from main.jsx when
 * navigator.serviceWorker fires 'controllerchange' after an update.
 */
export default function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw-updated', handler);
    return () => window.removeEventListener('sw-updated', handler);
  }, []);

  if (!show) return null;

  return (
    <div style={bannerStyle} role="alert" aria-live="polite">
      <span style={{ flexShrink: 0, display: 'flex' }} aria-hidden="true">
        {updateIcon}
      </span>
      <span style={{ flex: 1 }}>App updated — refresh to get the latest version</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={refreshBtnStyle}
      >
        Refresh
      </button>
    </div>
  );
}

const bannerStyle = {
  position:        'fixed',
  bottom:          'calc(64px + env(safe-area-inset-bottom))',
  left:            0,
  right:           0,
  zIndex:          9998,
  display:         'flex',
  alignItems:      'center',
  gap:             10,
  padding:         '12px 16px',
  backgroundColor: '#1e40af',  // blue-800
  color:           '#dbeafe',  // blue-100
  fontSize:        'var(--font-size-sm)',
  fontWeight:      600,
  boxShadow:       '0 -2px 12px rgba(0,0,0,0.4)',
  animation:       'bannerSlideDown 0.25s ease forwards',
};

const refreshBtnStyle = {
  flexShrink:      0,
  padding:         '6px 14px',
  borderRadius:    'var(--radius-md)',
  border:          '1px solid rgba(255,255,255,0.3)',
  background:      'rgba(255,255,255,0.15)',
  color:           '#fff',
  fontSize:        'var(--font-size-sm)',
  fontWeight:      700,
  cursor:          'pointer',
  whiteSpace:      'nowrap',
};

const updateIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
