import React, { useState, useEffect } from 'react';
import useOnlineStatus from '../hooks/useOnlineStatus.js';
import { useSyncQueue } from '../hooks/useSyncQueue.js';

/**
 * OfflineBanner
 *
 * Fixed banner at the top of the screen that reflects four states:
 *
 *   1. Offline, no pending actions  — "You're offline — changes will sync when reconnected"
 *   2. Offline, pending actions     — "You're offline — 3 actions pending sync"
 *   3. Back online, syncing         — "Syncing 3 pending actions..." (teal/sync banner)
 *   4. Sync complete                — "All caught up" (shown for 3 s then hidden)
 *
 * The banner slides down from the top with a CSS transition so it never
 * causes a jarring layout shift.
 */
export default function OfflineBanner() {
  const isOnline              = useOnlineStatus();
  const { queueLength, isSyncing } = useSyncQueue();

  // Controls the "All caught up" flash after a successful sync.
  const [showCaughtUp, setShowCaughtUp] = useState(false);

  // Track previous isSyncing value so we only show "caught up" when syncing
  // transitions from true → false (not on initial mount while already online).
  const prevIsSyncingRef = React.useRef(isSyncing);

  useEffect(() => {
    const wasSyncing = prevIsSyncingRef.current;
    prevIsSyncingRef.current = isSyncing;

    // Only trigger the "All caught up" message when a real sync cycle ends.
    if (isOnline && wasSyncing && !isSyncing) {
      setShowCaughtUp(true);
      const timer = setTimeout(() => setShowCaughtUp(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, isOnline]);

  // Nothing to show: online, not syncing, "caught up" window expired.
  if (isOnline && !isSyncing && !showCaughtUp) return null;

  // ---- Derive display values ---- //

  let bannerClass    = 'offline-banner';
  let bannerStyle    = offlineBannerStyle;
  let iconNode       = wifiOffIcon;
  let messageText;

  if (isOnline && isSyncing) {
    bannerClass  = 'offline-banner sync-banner';
    bannerStyle  = syncBannerStyle;
    iconNode     = syncIcon;
    messageText  = (
      <>
        Syncing
        {queueLength > 0 && (
          <span className="queue-count" style={queueCountStyle}>
            {queueLength}
          </span>
        )}
        {' '}pending action{queueLength !== 1 ? 's' : ''}…
      </>
    );
  } else if (isOnline && showCaughtUp) {
    bannerClass  = 'offline-banner sync-banner';
    bannerStyle  = caughtUpBannerStyle;
    iconNode     = checkIcon;
    messageText  = 'All caught up';
  } else {
    // Offline
    messageText = queueLength > 0
      ? (
          <>
            You&rsquo;re offline &mdash;{' '}
            <span className="queue-count" style={queueCountStyle}>
              {queueLength}
            </span>
            {' '}action{queueLength !== 1 ? 's' : ''} pending sync
          </>
        )
      : "You're offline — changes will sync when reconnected";
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={bannerClass}
      style={bannerStyle}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, display: 'flex' }}>
        {iconNode}
      </span>
      <span>{messageText}</span>
    </div>
  );
}

// ------------------------------------------------------------------ //
//  Inline styles (keep structural styles here; visual styles in CSS)  //
// ------------------------------------------------------------------ //

const baseBannerStyle = {
  position:       'fixed',
  top:            0,
  left:           0,
  right:          0,
  zIndex:         9999,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            8,
  padding:        '10px 16px',
  // Push below iOS status bar
  paddingTop:     'calc(10px + env(safe-area-inset-top))',
  fontSize:       'var(--font-size-sm)',
  fontWeight:     600,
  textAlign:      'center',
  boxShadow:      '0 2px 8px rgba(0,0,0,0.5)',
  // Slide-in animation driven by CSS class
  animation:      'bannerSlideDown 0.25s ease forwards',
};

const offlineBannerStyle = {
  ...baseBannerStyle,
  backgroundColor: '#92400e',  // amber-800
  color:           '#fef3c7',  // amber-100
};

const syncBannerStyle = {
  ...baseBannerStyle,
  backgroundColor: '#0f766e',  // teal-700
  color:           '#ccfbf1',  // teal-100
};

const caughtUpBannerStyle = {
  ...baseBannerStyle,
  backgroundColor: '#15803d',  // green-700
  color:           '#dcfce7',  // green-100
};

const queueCountStyle = {
  display:         'inline-flex',
  alignItems:      'center',
  justifyContent:  'center',
  minWidth:        '20px',
  height:          '20px',
  padding:         '0 5px',
  marginLeft:      4,
  marginRight:     4,
  borderRadius:    '9999px',
  backgroundColor: 'rgba(255,255,255,0.25)',
  fontSize:        '11px',
  fontWeight:      700,
  lineHeight:      1,
  verticalAlign:   'middle',
};

// ------------------------------------------------------------------ //
//  SVG icons                                                          //
// ------------------------------------------------------------------ //

const wifiOffIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const syncIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ animation: 'spin 1s linear infinite' }}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const checkIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
