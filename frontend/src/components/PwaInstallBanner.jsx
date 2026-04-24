import React, { useState, useEffect } from 'react';
import usePwaInstall, { SNOOZE_DAYS } from '../hooks/usePwaInstall.js';

// ---- iOS step icons ----
const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const PlusBoxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const TapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11V6a3 3 0 0 1 6 0v5" />
    <path d="M5 12h14l-1.5 7.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5L5 12z" />
  </svg>
);

const InstallIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v13" />
    <path d="M8 11l4 4 4-4" />
    <path d="M3 18h18" />
    <path d="M3 21h18" />
  </svg>
);

const IOS_STEPS = [
  { icon: <ShareIcon />,  label: 'Tap the', highlight: 'Share button', sub: 'in Safari\'s toolbar' },
  { icon: <PlusBoxIcon />, label: 'Select', highlight: '"Add to Home Screen"', sub: 'scroll down if needed' },
  { icon: <TapIcon />,    label: 'Tap', highlight: '"Add"', sub: 'top-right corner' },
];

export default function PwaInstallBanner() {
  const { show, platform, canPrompt, promptInstall, dismiss } = usePwaInstall();
  const [visible,     setVisible]     = useState(false);
  const [activeStep,  setActiveStep]  = useState(0);

  // Trigger slide-in after mount
  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [show]);

  // Cycle through iOS steps
  useEffect(() => {
    if (platform !== 'ios' || !visible) return;
    const t = setInterval(() => setActiveStep((s) => (s + 1) % IOS_STEPS.length), 2500);
    return () => clearInterval(t);
  }, [platform, visible]);

  if (!show) return null;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(dismiss, 300); // wait for slide-out
  };

  return (
    <div style={{ ...styles.overlay, transform: visible ? 'translateY(0)' : 'translateY(110%)' }}>
      {/* Header row */}
      <div style={styles.header}>
        <div style={styles.appIconWrap}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={styles.title}>Install Mover Hero</p>
          <p style={styles.subtitle}>Quick access from your home screen</p>
        </div>
        <button type="button" onClick={handleDismiss} style={styles.closeBtn} aria-label="Dismiss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* Android */}
      {platform === 'android' && (
        <div style={styles.androidBody}>
          {canPrompt ? (
            <>
              <p style={styles.androidHint}>Add to your home screen for the best experience — works offline too.</p>
              <button type="button" onClick={promptInstall} style={styles.installBtn}>
                <InstallIcon />
                Install App
              </button>
            </>
          ) : (
            <>
              <p style={styles.androidHint}>Open your browser menu and tap <strong>"Add to Home Screen"</strong> to install.</p>
              <div style={styles.menuHint}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                </svg>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Tap ⋮ menu → Add to Home Screen</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* iOS */}
      {platform === 'ios' && (
        <div style={styles.iosBody}>
          <div style={styles.stepsRow}>
            {IOS_STEPS.map((step, i) => (
              <div
                key={i}
                style={{
                  ...styles.step,
                  ...(i === activeStep ? styles.stepActive : styles.stepInactive),
                }}
              >
                <div style={{ ...styles.stepIconWrap, ...(i === activeStep ? styles.stepIconActive : {}) }}>
                  {step.icon}
                </div>
                <div style={styles.stepText}>
                  <span style={styles.stepNum}>{i + 1}</span>
                  <span style={styles.stepLabel}>{step.label} </span>
                  <span style={styles.stepHighlight}>{step.highlight}</span>
                </div>
                <p style={styles.stepSub}>{step.sub}</p>
              </div>
            ))}
          </div>

          {/* Step dots */}
          <div style={styles.dotsRow}>
            {IOS_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveStep(i)}
                style={{ ...styles.dot, ...(i === activeStep ? styles.dotActive : styles.dotInactive) }}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>

          {/* Arrow pointing to Safari toolbar */}
          {activeStep === 0 && (
            <div style={styles.arrowHint}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
              </svg>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
                Share button is in Safari's bottom toolbar
              </span>
            </div>
          )}
        </div>
      )}

      <p style={styles.snoozeNote}>Tap × to hide for {SNOOZE_DAYS} days</p>
    </div>
  );
}

/* ---- Styles ---- */
const styles = {
  overlay: {
    position:       'fixed',
    bottom:         'calc(64px + env(safe-area-inset-bottom))', // above BottomNav + safe area
    left:           0,
    right:          0,
    zIndex:         200,
    backgroundColor:'var(--color-surface)',
    borderTop:      '1px solid var(--color-border)',
    borderRadius:   '20px 20px 0 0',
    padding:        '16px 16px 12px',
    boxShadow:      '0 -8px 32px rgba(0,0,0,0.25)',
    transition:     'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
    willChange:     'transform',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    gap:            12,
    marginBottom:   0,
  },
  appIconWrap: {
    width:          44,
    height:         44,
    borderRadius:   12,
    backgroundColor:'var(--color-surface-2)',
    border:         '1px solid var(--color-border)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  title: {
    fontSize:       'var(--font-size-sm)',
    fontWeight:     700,
    color:          'var(--color-text)',
  },
  subtitle: {
    fontSize:       'var(--font-size-xs)',
    color:          'var(--color-text-muted)',
    marginTop:      2,
  },
  closeBtn: {
    background:     'var(--color-surface-2)',
    border:         '1px solid var(--color-border)',
    borderRadius:   '50%',
    width:          30,
    height:         30,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    cursor:         'pointer',
    color:          'var(--color-text-muted)',
    padding:        0,
    flexShrink:     0,
  },
  divider: {
    height:         1,
    backgroundColor:'var(--color-border)',
    margin:         '12px 0',
  },

  // Android
  androidBody: {
    display:        'flex',
    flexDirection:  'column',
    gap:            12,
  },
  androidHint: {
    fontSize:       'var(--font-size-sm)',
    color:          'var(--color-text-muted)',
    lineHeight:     1.5,
  },
  installBtn: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    width:          '100%',
    padding:        '12px 0',
    backgroundColor:'var(--color-primary)',
    color:          '#fff',
    border:         'none',
    borderRadius:   'var(--radius-md)',
    fontSize:       'var(--font-size-sm)',
    fontWeight:     700,
    cursor:         'pointer',
  },
  menuHint: {
    display:        'flex',
    alignItems:     'center',
    gap:            8,
    backgroundColor:'var(--color-surface-2)',
    border:         '1px solid var(--color-border)',
    borderRadius:   'var(--radius-md)',
    padding:        '10px 12px',
  },

  // iOS
  iosBody: {
    display:        'flex',
    flexDirection:  'column',
    gap:            12,
  },
  stepsRow: {
    display:        'flex',
    gap:            8,
  },
  step: {
    flex:           1,
    borderRadius:   'var(--radius-md)',
    padding:        '10px 8px',
    border:         '1px solid var(--color-border)',
    transition:     'all 0.3s ease',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            6,
    textAlign:      'center',
  },
  stepActive: {
    backgroundColor:'rgba(var(--color-primary-rgb, 99,102,241), 0.1)',
    borderColor:    'var(--color-primary)',
    transform:      'scale(1.03)',
  },
  stepInactive: {
    backgroundColor:'var(--color-surface-2)',
    opacity:        0.6,
  },
  stepIconWrap: {
    color:          'var(--color-text-muted)',
    transition:     'color 0.3s',
  },
  stepIconActive: {
    color:          'var(--color-primary)',
  },
  stepText: {
    fontSize:       'var(--font-size-xs)',
    color:          'var(--color-text)',
    lineHeight:     1.4,
  },
  stepNum: {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          16,
    height:         16,
    borderRadius:   '50%',
    backgroundColor:'var(--color-primary)',
    color:          '#fff',
    fontSize:       10,
    fontWeight:     700,
    marginRight:    4,
  },
  stepLabel: {
    color:          'var(--color-text-muted)',
  },
  stepHighlight: {
    fontWeight:     700,
    color:          'var(--color-text)',
  },
  stepSub: {
    fontSize:       9,
    color:          'var(--color-text-dim)',
    marginTop:      2,
  },
  dotsRow: {
    display:        'flex',
    justifyContent: 'center',
    gap:            6,
  },
  dot: {
    width:          6,
    height:         6,
    borderRadius:   '50%',
    border:         'none',
    cursor:         'pointer',
    padding:        0,
    transition:     'all 0.25s',
  },
  dotActive: {
    backgroundColor:'var(--color-primary)',
    width:          18,
    borderRadius:   3,
  },
  dotInactive: {
    backgroundColor:'var(--color-border)',
  },
  arrowHint: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    animation:      'bounce 1.5s ease-in-out infinite',
  },
  snoozeNote: {
    textAlign:      'center',
    fontSize:       'var(--font-size-xs)',
    color:          'var(--color-text-dim)',
    marginTop:      10,
  },
};
