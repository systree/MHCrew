import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminJobs } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';
import { formatDateTime } from '../../utils/formatters.js';

const STATUS_FILTERS = ['All', 'assigned', 'enroute', 'arrived', 'in_progress', 'completed', 'cancelled'];

const STATUS_LABELS = {
  assigned:    'Assigned',
  enroute:     'En Route',
  arrived:     'Arrived',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

const STATUS_COLORS = {
  assigned:    { bg: 'rgba(136,136,170,0.12)', color: 'var(--color-text-muted)', border: 'var(--color-border)' },
  enroute:     { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa',                 border: 'rgba(59,130,246,0.3)' },
  arrived:     { bg: 'rgba(234,179,8,0.12)',   color: '#facc15',                 border: 'rgba(234,179,8,0.3)' },
  in_progress: { bg: 'rgba(249,115,22,0.12)',  color: '#fb923c',                 border: 'rgba(249,115,22,0.3)' },
  completed:   { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80',                 border: 'rgba(34,197,94,0.25)' },
  cancelled:   { bg: 'rgba(239,68,68,0.1)',    color: '#f87171',                 border: 'rgba(239,68,68,0.25)' },
};

export default function AdminJobsPage() {
  const navigate = useNavigate();

  const [jobs,       setJobs]       = useState([]);
  const [filter,     setFilter]     = useState('All');
  const [loadState,  setLoadState]  = useState({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdminJobs();
        if (cancelled) return;
        setJobs(data.jobs ?? []);
        setLoadState({ loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setLoadState({ loading: false, error: err?.response?.data?.error ?? 'Failed to load jobs.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'All' ? jobs : jobs.filter((j) => j.status === filter);

  const counts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f] = f === 'All' ? jobs.length : jobs.filter((j) => j.status === f).length;
    return acc;
  }, {});

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div style={styles.headerRow}>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            aria-label="Back to Admin"
            style={styles.backBtn}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={styles.headerTitle}>Jobs</h1>
            {!loadState.loading && (
              <p style={styles.headerSub}>{jobs.length} job{jobs.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <span style={{ width: 40 }} />
        </div>
      </header>

      {/* Content */}
      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Filter tabs */}
        {!loadState.loading && jobs.length > 0 && (
          <div style={styles.filterScroll}>
            <div style={styles.filterRow}>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    ...styles.filterBtn,
                    ...(filter === f ? styles.filterBtnActive : {}),
                  }}
                >
                  {f === 'All' ? 'All' : STATUS_LABELS[f]}
                  <span style={{
                    ...styles.filterCount,
                    ...(filter === f ? styles.filterCountActive : {}),
                  }}>
                    {counts[f]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loadState.loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={styles.skeleton} aria-hidden="true" />
            ))}
          </div>
        )}

        {/* Error */}
        {loadState.error && (
          <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
            {loadState.error}
          </div>
        )}

        {/* Empty state */}
        {!loadState.loading && !loadState.error && jobs.length === 0 && (
          <div style={styles.emptyState}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 12 }}>
              No jobs found
            </p>
          </div>
        )}

        {/* Filtered empty */}
        {!loadState.loading && jobs.length > 0 && filtered.length === 0 && (
          <div style={styles.emptyState}>
            <p style={{ color: 'var(--color-text-muted)' }}>No {STATUS_LABELS[filter] ?? filter} jobs.</p>
          </div>
        )}

        {/* Job cards */}
        {filtered.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}

      </main>

      <BottomNav />
    </div>
  );
}

function JobCard({ job }) {
  const colors = STATUS_COLORS[job.status] ?? STATUS_COLORS.assigned;
  const date = job.scheduled_date ? formatDateTime(job.scheduled_date) : null;

  return (
    <div className="card" style={styles.jobCard}>
      {/* Top row: customer + status badge */}
      <div style={styles.jobTop}>
        <p style={styles.customerName}>{job.customer_name || 'Unknown Customer'}</p>
        <span style={{ ...styles.statusBadge, backgroundColor: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
      </div>

      {/* Date */}
      {date && (
        <div style={styles.jobMeta}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {date}
        </div>
      )}

      {/* Addresses */}
      {job.pickup_address && (
        <div style={styles.jobMeta}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z" />
          </svg>
          <span style={styles.addressText}>{job.pickup_address}</span>
        </div>
      )}
      {job.dropoff_address && (
        <div style={styles.jobMeta}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z" />
          </svg>
          <span style={styles.addressText}>{job.dropoff_address}</span>
        </div>
      )}

      {/* Assigned crew */}
      {job.crew && job.crew.length > 0 && (
        <div style={styles.jobMeta}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span style={styles.addressText}>{job.crew.join(', ')}</span>
        </div>
      )}

      {/* Cancellation reason */}
      {job.cancellation_reason && (
        <p style={styles.cancelReason}>Reason: {job.cancellation_reason}</p>
      )}
    </div>
  );
}

/* ---- Styles ---- */

const styles = {
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 800,
    color: 'var(--color-text)',
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 1,
  },
  backBtn: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-muted)',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
    cursor: 'pointer',
  },
  filterScroll: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    marginLeft: 'calc(var(--spacing-md) * -1)',
    marginRight: 'calc(var(--spacing-md) * -1)',
    paddingLeft: 'var(--spacing-md)',
    paddingRight: 'var(--spacing-md)',
    paddingBottom: 4,
  },
  filterRow: {
    display: 'flex',
    gap: 6,
    width: 'max-content',
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
  },
  filterBtnActive: {
    backgroundColor: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    color: '#fff',
  },
  filterCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 18,
    padding: '0 4px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    backgroundColor: 'var(--color-surface-2)',
    color: 'var(--color-text-muted)',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
  skeleton: {
    height: 90,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-surface)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 0',
    textAlign: 'center',
  },
  feedbackBanner: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
  },
  feedbackError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
  },
  jobCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  jobTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  customerName: {
    fontWeight: 700,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  jobMeta: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    lineHeight: 1.4,
  },
  addressText: {
    flex: 1,
    minWidth: 0,
  },
  cancelReason: {
    fontSize: 'var(--font-size-xs)',
    color: '#f87171',
    fontStyle: 'italic',
  },
};
