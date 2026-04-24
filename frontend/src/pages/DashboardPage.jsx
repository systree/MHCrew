import React, { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import useJobs from '../hooks/useJobs.js';
import JobCard from '../components/JobCard.jsx';
import BottomNav from '../components/BottomNav.jsx';
import PwaInstallBanner from '../components/PwaInstallBanner.jsx';
import NotificationPromptCard from '../components/NotificationPromptCard.jsx';
import LocationPromptCard from '../components/LocationPromptCard.jsx';
import { localDateString, formatDate } from '../utils/formatters.js';

export default function DashboardPage() {
  const user                          = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab]     = useState('upcoming');
  const [refreshing, setRefreshing]   = useState(false);

  const { jobs, loading, error, refresh } = useJobs(activeTab);

  const displayName = user?.name ?? user?.full_name ?? 'Crew';

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const grouped = activeTab === 'upcoming' ? groupJobsByDay(jobs) : null;

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.headerTitle}>My Jobs</h1>
            <p style={styles.headerSub}>Hey {displayName.split(' ')[0]}</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-label="Refresh jobs"
            style={styles.refreshBtn}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{
                transition: 'transform 0.5s ease',
                animation: (loading || refreshing) ? 'spin 0.7s linear infinite' : 'none',
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabRow}>
          {['upcoming', 'history'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : styles.tabInactive),
              }}
            >
              {tab === 'upcoming' ? 'Upcoming' : 'History'}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Notification permission prompt — shown once on first visit */}
        <NotificationPromptCard />
        {/* Location permission prompt — shown once on first visit */}
        <LocationPromptCard />

        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && jobs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={styles.skeleton} aria-hidden="true" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && !error && (
          <div style={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <p style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 12 }}>
              {activeTab === 'upcoming' ? 'No jobs assigned' : 'No past jobs'}
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-dim)', marginTop: 4 }}>
              {activeTab === 'upcoming'
                ? 'Check back later or contact your dispatcher.'
                : 'Completed and cancelled jobs will appear here.'}
            </p>
          </div>
        )}

        {/* Upcoming — grouped by date */}
        {activeTab === 'upcoming' && grouped && grouped.map(({ label, items }) => (
          <section key={label}>
            <h2 style={styles.groupLabel}>{label}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </section>
        ))}

        {/* History — flat list, newest first */}
        {activeTab === 'history' && jobs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </main>

      <PwaInstallBanner />
      <BottomNav />
    </div>
  );
}

/* ---- Helpers ---- */

function groupJobsByDay(jobs) {
  if (!jobs?.length) return [];

  const now = Date.now();
  const todayStr    = localDateString(new Date(now));
  const tomorrowStr = localDateString(new Date(now + 86_400_000));

  const groups = {};

  for (const job of jobs) {
    const date = new Date(job.scheduled_date ?? job.scheduled_at ?? job.scheduledAt ?? now);
    const dateStr = localDateString(date);
    let label;
    if (dateStr === todayStr)         label = 'Today';
    else if (dateStr === tomorrowStr) label = 'Tomorrow';
    else label = formatDate(date);

    if (!groups[label]) groups[label] = { dateStr, items: [] };
    groups[label].items.push(job);
  }

  return Object.entries(groups)
    .sort(([, a], [, b]) => a.dateStr.localeCompare(b.dateStr))
    .map(([label, { items }]) => ({ label, items }));
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
  refreshBtn: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-muted)',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
  tabRow: {
    display: 'flex',
    gap: 8,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.15s, color 0.15s',
  },
  tabActive: {
    background: 'var(--color-primary)',
    color: '#fff',
  },
  tabInactive: {
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-muted)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(234,179,8,0.1)',
    border: '1px solid rgba(234,179,8,0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#fbbf24',
    fontSize: 'var(--font-size-sm)',
    padding: '10px 14px',
  },
  skeleton: {
    height: 96,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-surface)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
  },
  groupLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
};
