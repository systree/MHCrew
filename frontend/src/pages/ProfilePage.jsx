import React, { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import useAuth from '../hooks/useAuth.js';
import BottomNav from '../components/BottomNav.jsx';
import { initials, formatPhone, formatMonthYear } from '../utils/formatters.js';
import { usePushNotifications } from '../hooks/usePushNotifications.js';

/**
 * ProfilePage
 *
 * Displays the authenticated crew member's profile details.
 * Provides a sign-out action.
 * Future: editable fields, notification preferences, PIN change.
 */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const {
    supported: pushSupported,
    permission,
    subscribed,
    loading: pushLoading,
    error: pushError,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const name  = user?.name        ?? user?.full_name   ?? 'Crew Member';
  const phone = user?.phone       ?? '';
  const email = user?.email       ?? '';
  const role  = user?.role        ?? user?.position    ?? 'Crew';
  const team  = user?.team        ?? '';
  const since = user?.created_at  ?? user?.createdAt   ?? '';

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>Profile</h1>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Avatar + name */}
        <div style={styles.hero}>
          <div style={styles.avatar}>
            <span style={styles.avatarInitials}>{initials(name)}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text)' }}>{name}</h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>
              {role}{team ? ` · ${team}` : ''}
            </p>
          </div>
        </div>

        {/* Contact info */}
        <Section title="Contact">
          {phone && (
            <ProfileRow
              icon={phoneIcon}
              label="Mobile"
              value={
                <a href={`tel:${phone}`} style={{ color: 'var(--color-text)' }}>
                  {formatPhone(phone)}
                </a>
              }
            />
          )}
          {email && (
            <ProfileRow
              icon={emailIcon}
              label="Email"
              value={
                <a href={`mailto:${email}`} style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>
                  {email}
                </a>
              }
            />
          )}
        </Section>

        {/* Account */}
        <Section title="Account">
          {since && (
            <ProfileRow
              icon={calendarIcon}
              label="Member since"
              value={formatMonthYear(since)}
            />
          )}
          <ProfileRow
            icon={shieldIcon}
            label="Authentication"
            value="Phone OTP + PIN"
          />
        </Section>

        {/* Notifications */}
        {pushSupported && (
          <Section title="Notifications">
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                    Job Notifications
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {permission === 'denied'
                      ? 'Blocked in browser settings'
                      : subscribed
                      ? 'You will receive push notifications'
                      : 'Get notified when jobs are assigned'}
                  </p>
                </div>
                {permission === 'denied' ? (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--status-cancelled)', fontWeight: 600 }}>
                    Blocked
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={subscribed ? unsubscribe : subscribe}
                    disabled={pushLoading}
                    style={{
                      minWidth: 72,
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: subscribed
                        ? '1px solid rgba(239,68,68,0.3)'
                        : '1px solid rgba(233,69,96,0.4)',
                      background: subscribed
                        ? 'rgba(239,68,68,0.1)'
                        : 'var(--color-primary)',
                      color: subscribed ? '#f87171' : '#fff',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      cursor: pushLoading ? 'not-allowed' : 'pointer',
                      opacity: pushLoading ? 0.6 : 1,
                    }}
                  >
                    {pushLoading ? '…' : subscribed ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
              {pushError && (
                <p style={{ fontSize: 'var(--font-size-xs)', color: '#f87171' }}>{pushError}</p>
              )}
            </div>
          </Section>
        )}

        {/* App info */}
        <Section title="App">
          <ProfileRow icon={infoIcon} label="Version" value="1.0.0" />
          <ProfileRow icon={syncIcon}  label="Sync"    value="Auto (online)" />
        </Section>

        {/* Sign out */}
        <div style={{ marginTop: 8 }}>
          {confirmLogout ? (
            <div style={styles.confirmBox}>
              <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 12, textAlign: 'center' }}>
                Sign out of Mover Hero Crew?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setConfirmLogout(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1, backgroundColor: 'var(--status-cancelled)' }}
                  onClick={logout}
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-secondary"
              style={{ color: 'var(--status-cancelled)', borderColor: 'rgba(239,68,68,0.3)' }}
              onClick={() => setConfirmLogout(true)}
            >
              Sign Out
            </button>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

/* ---- Sub-components ---- */

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 16px 8px', borderBottom: '1px solid var(--color-border)' }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function ProfileRow({ icon, label, value }) {
  return (
    <div style={styles.profileRow}>
      <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', minWidth: 90 }}>{label}</span>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', flex: 1 }}>{value}</span>
    </div>
  );
}

/* ---- Icons ---- */

const phoneIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.28h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.08-1.08a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const emailIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
);

const calendarIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const shieldIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const infoIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const syncIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

/* ---- Styles ---- */

const styles = {
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e94560, #c73652)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(233,69,96,0.4)',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '0.02em',
  },
  profileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
  },
  confirmBox: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
  },
};
