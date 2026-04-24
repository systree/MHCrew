import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import { syncJobs, syncLocation, syncStages, refreshFields, provisionFields, syncCrew } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

/**
 * AdminDashboardPage
 *
 * Overview page for admins. Provides quick-action buttons and
 * navigation links to each admin sub-section.
 */
export default function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);

  const [syncState,      setSyncState]      = useState({ loading: false, result: null, error: null });
  const [locationState,  setLocationState]  = useState({ loading: false, result: null, error: null });
  const [stagesState,    setStagesState]    = useState({ loading: false, result: null, error: null });
  const [refreshState,   setRefreshState]   = useState({ loading: false, result: null, error: null });
  const [provisionState, setProvisionState] = useState({ loading: false, result: null, error: null });
  const [crewSyncState,  setCrewSyncState]  = useState({ loading: false, result: null, error: null });

  const locationLabel = user?.locationId ?? null;

  /* ---- Handlers ---- */

  const handleSync = async () => {
    setSyncState({ loading: true, result: null, error: null });
    try {
      const data = await syncJobs();
      setSyncState({ loading: false, result: data, error: null });
    } catch (err) {
      setSyncState({ loading: false, result: null, error: err?.response?.data?.message ?? 'Sync failed.' });
    }
  };

  const handleSyncLocation = async () => {
    setLocationState({ loading: true, result: null, error: null });
    try {
      const data = await syncLocation();
      setLocationState({ loading: false, result: data, error: null });
    } catch (err) {
      setLocationState({ loading: false, result: null, error: err?.response?.data?.error ?? 'Sync failed.' });
    }
  };

  const handleSyncStages = async () => {
    setStagesState({ loading: true, result: null, error: null });
    try {
      const data = await syncStages();
      setStagesState({ loading: false, result: data, error: null });
    } catch (err) {
      setStagesState({ loading: false, result: null, error: err?.response?.data?.error ?? 'Sync failed.' });
    }
  };

  const handleRefresh = async () => {
    setRefreshState({ loading: true, result: null, error: null });
    try {
      const data = await refreshFields();
      setRefreshState({ loading: false, result: data, error: null });
    } catch (err) {
      setRefreshState({ loading: false, result: null, error: err?.response?.data?.message ?? 'Refresh failed.' });
    }
  };

  const handleProvision = async () => {
    setProvisionState({ loading: true, result: null, error: null });
    try {
      const data = await provisionFields();
      setProvisionState({ loading: false, result: data, error: null });
    } catch (err) {
      setProvisionState({ loading: false, result: null, error: err?.response?.data?.error ?? 'Could not reach GHL. Try again in a minute.' });
    }
  };

  const handleSyncCrew = async () => {
    setCrewSyncState({ loading: true, result: null, error: null });
    try {
      const data = await syncCrew();
      setCrewSyncState({ loading: false, result: data, error: null });
    } catch (err) {
      setCrewSyncState({ loading: false, result: null, error: err?.response?.data?.error ?? 'Sync failed.' });
    }
  };

  /* ---- Render ---- */

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.headerTitle}>Admin Panel</h1>
            {locationLabel && (
              <p style={styles.headerSub}>{locationLabel}</p>
            )}
          </div>
          {/* Gear icon */}
          <span style={styles.headerIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Section: Navigation */}
        <section>
          <p style={styles.sectionLabel}>Configuration</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <AdminNavCard
              to="/admin/pipeline"
              title="Pipeline Setup"
              description="Choose which GHL pipeline this app monitors"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
            />
            <AdminNavCard
              to="/admin/stages"
              title="Stage Mapping"
              description="Map pipeline stages to crew job statuses"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              }
            />
            <AdminNavCard
              to="/admin/crew"
              title="Crew Management"
              description="View, activate, and assign roles to crew members"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
            <AdminNavCard
              to="/admin/invoice-settings"
              title="Invoice Settings"
              description="Configure tax rate and invoice defaults"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="12" y2="17" />
                </svg>
              }
            />
            <AdminNavCard
              to="/admin/jobs"
              title="Jobs"
              description="View all jobs across all crew members"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              }
            />
            <AdminNavCard
              to="/admin/notification-settings"
              title="Notification Settings"
              description="Control which push notifications are sent to crew and admins"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Section: Setup Guide */}
        <SetupGuide />

        {/* Section: Quick Actions */}
        <section>
          <p style={styles.sectionLabel}>Quick Actions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>

            {/* Sync Location */}
            <div className="card">
              <div style={styles.actionCardHeader}>
                <div>
                  <p style={styles.actionTitle}>Sync Location</p>
                  <p style={styles.actionDesc}>Re-fetch business details and timezone from GHL</p>
                </div>
              </div>
              {locationState.result && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
                  Location synced{locationState.result.name ? ` — ${locationState.result.name}` : ''}.
                </div>
              )}
              {locationState.error && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
                  {locationState.error}
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={handleSyncLocation}
                disabled={locationState.loading}
                style={{ marginTop: 12 }}
              >
                {locationState.loading ? (
                  <span style={styles.btnInner}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Syncing…
                  </span>
                ) : 'Sync Location'}
              </button>
            </div>

            {/* Initialize Fields */}
            <div className="card">
              <div style={styles.actionCardHeader}>
                <div>
                  <p style={styles.actionTitle}>Initialize Required Fields</p>
                  <p style={styles.actionDesc}>Creates the 6 required GHL custom fields if they don't exist yet</p>
                </div>
              </div>

              {provisionState.result && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
                  {provisionState.result.created?.length > 0
                    ? `Created: ${provisionState.result.created.join(', ')}`
                    : 'All required fields already exist.'}
                  {provisionState.result.failed?.length > 0 &&
                    ` | Failed: ${provisionState.result.failed.join(', ')}`}
                </div>
              )}
              {provisionState.error && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
                  {provisionState.error}
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={handleProvision}
                disabled={provisionState.loading}
                style={{ marginTop: 12 }}
              >
                {provisionState.loading ? (
                  <span style={styles.btnInner}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Initializing…
                  </span>
                ) : 'Initialize Fields'}
              </button>
            </div>

            {/* Sync Crew */}
            <div className="card">
              <div style={styles.actionCardHeader}>
                <div>
                  <p style={styles.actionTitle}>Sync Crew</p>
                  <p style={styles.actionDesc}>Re-import all GHL users as crew members</p>
                </div>
              </div>

              {crewSyncState.result && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
                  Synced {crewSyncState.result.synced ?? 0} crew member{crewSyncState.result.synced !== 1 ? 's' : ''}.
                </div>
              )}
              {crewSyncState.error && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
                  {crewSyncState.error}
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={handleSyncCrew}
                disabled={crewSyncState.loading}
                style={{ marginTop: 12 }}
              >
                {crewSyncState.loading ? (
                  <span style={styles.btnInner}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Syncing…
                  </span>
                ) : 'Sync Crew'}
              </button>
            </div>

            {/* Sync Jobs */}
            <div className="card">
              <div style={styles.actionCardHeader}>
                <div>
                  <p style={styles.actionTitle}>Sync Jobs</p>
                  <p style={styles.actionDesc}>Pull latest jobs from GHL into the app</p>
                </div>
              </div>

              {syncState.result && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
                  Synced {syncState.result.synced ?? 0} job{syncState.result.synced !== 1 ? 's' : ''} successfully.
                </div>
              )}
              {syncState.error && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
                  {syncState.error}
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={handleSync}
                disabled={syncState.loading}
                style={{ marginTop: 12 }}
              >
                {syncState.loading ? (
                  <span style={styles.btnInner}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Syncing…
                  </span>
                ) : 'Sync Now'}
              </button>
            </div>

            {/* Sync Pipeline Stages */}
            <div className="card">
              <div style={styles.actionCardHeader}>
                <div>
                  <p style={styles.actionTitle}>Sync Pipeline Stages</p>
                  <p style={styles.actionDesc}>Re-fetch stages from the active GHL pipeline</p>
                </div>
              </div>
              {stagesState.result && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
                  Synced {stagesState.result.synced ?? 0} stage{stagesState.result.synced !== 1 ? 's' : ''}.
                </div>
              )}
              {stagesState.error && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
                  {stagesState.error}
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={handleSyncStages}
                disabled={stagesState.loading}
                style={{ marginTop: 12 }}
              >
                {stagesState.loading ? (
                  <span style={styles.btnInner}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Syncing…
                  </span>
                ) : 'Sync Stages'}
              </button>
            </div>

            {/* Refresh Field Definitions */}
            <div className="card">
              <div style={styles.actionCardHeader}>
                <div>
                  <p style={styles.actionTitle}>Refresh Field Definitions</p>
                  <p style={styles.actionDesc}>Re-import custom field schema from GHL</p>
                </div>
              </div>

              {refreshState.result && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
                  Field definitions refreshed.
                </div>
              )}
              {refreshState.error && (
                <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
                  {refreshState.error}
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={handleRefresh}
                disabled={refreshState.loading}
                style={{ marginTop: 12 }}
              >
                {refreshState.loading ? (
                  <span style={styles.btnInner}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Refreshing…
                  </span>
                ) : 'Refresh Fields'}
              </button>
            </div>

          </div>
        </section>

      </main>

      <BottomNav />
    </div>
  );
}

/* ---- Sub-component: setup guide ---- */

function SetupGuide() {
  const [open, setOpen] = React.useState(false);

  const scenarios = [
    {
      title: 'After reinstall (app reinstalled via GHL)',
      note: 'GHL automatically restores the tenant record, crew, and field definitions.',
      steps: [
        { label: 'Pipeline Setup',  desc: 'Pick the GHL pipeline this app monitors.' },
        { label: 'Stage Mapping',   desc: 'Map pipeline stages to crew job statuses.' },
        { label: 'Sync Jobs',       desc: 'Pull all open jobs from GHL into the app.' },
      ],
    },
    {
      title: 'After data reset (nuke without reinstall)',
      note: 'Everything is wiped — run these Quick Actions to restore manually.',
      steps: [
        { label: 'Sync Location',  desc: 'Recreates the tenant record with your GHL business details.' },
        { label: 'Sync Crew',      desc: 'Re-imports all GHL users as crew members.' },
        { label: 'Pipeline Setup', desc: 'Pick the GHL pipeline this app monitors.' },
        { label: 'Sync Jobs',      desc: 'Pull all open jobs from GHL into the app.' },
      ],
    },
  ];

  return (
    <div style={setupStyles.wrapper}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={setupStyles.trigger}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={setupStyles.triggerText}>Setup &amp; recovery guide</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={setupStyles.body}>
          {scenarios.map(({ title, note, steps }) => (
            <div key={title} style={setupStyles.scenario}>
              <p style={setupStyles.scenarioTitle}>{title}</p>
              <p style={setupStyles.scenarioNote}>{note}</p>
              <ol style={setupStyles.list}>
                {steps.map(({ label, desc }, i) => (
                  <li key={label} style={setupStyles.item}>
                    <span style={setupStyles.stepNum}>{i + 1}</span>
                    <div>
                      <span style={setupStyles.stepLabel}>{label}</span>
                      <span style={setupStyles.stepDesc}> — {desc}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p style={setupStyles.note}>Stage mapping is always reset after a data wipe and must be redone.</p>
        </div>
      )}
    </div>
  );
}

/* ---- Sub-component: nav card ---- */

function AdminNavCard({ to, title, description, icon }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card" style={navCardStyles.card}>
        <span style={navCardStyles.iconWrap}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={navCardStyles.title}>{title}</p>
          <p style={navCardStyles.desc}>{description}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

/* ---- Styles ---- */

const styles = {
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  headerSub: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  actionCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionTitle: {
    fontWeight: 700,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
  },
  actionDesc: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
  feedbackBanner: {
    marginTop: 10,
    padding: '9px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80',
  },
  feedbackError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
  },
  btnInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
};

const setupStyles = {
  wrapper: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  trigger: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#93c5fd',
  },
  triggerText: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: '#93c5fd',
  },
  body: {
    padding: '0 14px 12px',
    borderTop: '1px solid rgba(59,130,246,0.2)',
  },
  scenario: {
    marginTop: 12,
  },
  scenarioTitle: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: 'var(--color-text)',
    marginBottom: 2,
  },
  scenarioNote: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginBottom: 8,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: 'rgba(59,130,246,0.2)',
    border: '1px solid rgba(59,130,246,0.4)',
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  stepDesc: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
  },
  note: {
    marginTop: 10,
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-dim)',
    fontStyle: 'italic',
  },
};

const navCardStyles = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    cursor: 'pointer',
    transition: 'border-color var(--transition-fast)',
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-primary)',
    flexShrink: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
  },
  desc: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
};
