import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getActivityLog } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

// ---------------------------------------------------------------------------
// Human-readable labels per category.action
// ---------------------------------------------------------------------------
const ACTION_LABELS = {
  // Auth
  'auth.otp_sent':           'OTP sent',
  'auth.otp_send_error':     'OTP send error',
  'auth.otp_verify_failed':  'Login failed',
  'auth.login_success':      'Logged in',
  // Job
  'job.status_update':        'Job status changed',
  'job.status_update_invalid':'Invalid status change',
  'job.job_viewed':           'Job viewed',
  // Invoice
  'invoice.invoice_created':     'Invoice created',
  'invoice.invoice_sent':        'Invoice sent',
  'invoice.invoice_deleted':     'Invoice deleted',
  'invoice.invoice_from_estimate': 'Invoice from estimate',
  'invoice.payment_recorded':    'Payment recorded',
  // Admin
  'admin.pipeline_set':                     'Pipeline selected',
  'admin.stages_updated':                   'Stage mapping updated',
  'admin.crew_updated':                     'Crew member updated',
  'admin.sync_jobs':                        'Jobs synced from GHL',
  'admin.sync_location':                    'Location synced from GHL',
  'admin.sync_stages':                      'Stages synced from GHL',
  'admin.sync_crew':                        'Crew synced from GHL',
  'admin.provision_fields':                 'Fields provisioned',
  'admin.invoice_settings_updated':         'Invoice settings updated',
  'admin.notification_settings_updated':    'Notification settings updated',
  'admin.billing_rules_updated':            'Billing rules updated',
  // Webhook
  'webhook.install':   'App installed',
  'webhook.uninstall': 'App uninstalled',
};

const CATEGORY_COLORS = {
  auth:    { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', text: '#a78bfa' },
  job:     { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa' },
  invoice: { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  text: '#4ade80' },
  admin:   { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', text: '#fb923c' },
  webhook: { bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.35)',  text: '#facc15' },
  system:  { bg: 'rgba(107,114,128,0.12)',border: 'rgba(107,114,128,0.35)',text: '#9ca3af' },
};

const LEVEL_COLORS = {
  warn:  { color: '#fbbf24' },
  error: { color: '#f87171' },
  info:  { color: 'var(--color-text-muted)' },
};

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getLabel(category, action) {
  return ACTION_LABELS[`${category}.${action}`] ?? `${category}: ${action}`;
}

function formatMeta(category, action, meta) {
  if (!meta) return null;
  const parts = [];

  if (action === 'status_update' && meta.from && meta.to) {
    parts.push(`${meta.from} → ${meta.to}`);
  } else if (action === 'invoice_created' && meta.title) {
    parts.push(`"${meta.title}"`);
  } else if (action === 'payment_recorded' && meta.amount != null) {
    parts.push(`$${Number(meta.amount).toFixed(2)}`);
  } else if (action === 'sync_jobs' && meta.synced != null) {
    parts.push(`${meta.synced} job${meta.synced !== 1 ? 's' : ''}`);
  } else if (action === 'sync_crew' && meta.synced != null) {
    parts.push(`${meta.synced} crew member${meta.synced !== 1 ? 's' : ''}`);
  } else if (action === 'sync_stages' && meta.synced != null) {
    parts.push(`${meta.synced} stage${meta.synced !== 1 ? 's' : ''}`);
  } else if (action === 'stages_updated' && meta.updated != null) {
    parts.push(`${meta.updated} stage${meta.updated !== 1 ? 's' : ''}`);
  } else if (action === 'otp_sent' && meta.phone) {
    parts.push(meta.phone);
  } else if (action === 'otp_verify_failed' && meta.phone) {
    parts.push(meta.phone);
    if (meta.reason) parts.push(`(${meta.reason})`);
  } else if (action === 'crew_updated') {
    const changes = Object.entries(meta)
      .filter(([k]) => k !== 'targetId')
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    if (changes) parts.push(changes);
  }

  return parts.length ? parts.join(' ') : null;
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
}

function formatAbsTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminActivityPage() {
  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [offset,      setOffset]      = useState(0);

  const fetchPage = useCallback(async (pageOffset, append = false) => {
    try {
      const data = await getActivityLog({ limit: PAGE_SIZE, offset: pageOffset });
      const rows = data.entries ?? [];
      setEntries((prev) => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);
      setOffset(pageOffset + rows.length);
    } catch {
      setError('Failed to load activity log.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPage(0, false).finally(() => setLoading(false));
  }, [fetchPage]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    await fetchPage(0, false);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchPage(offset, true);
    setLoadingMore(false);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Link
            to="/admin"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-muted)',
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, textDecoration: 'none',
            }}
            aria-label="Back to Admin"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
              Activity Log
            </h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 1 }}>
              Critical events across all users
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-muted)',
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: refreshing || loading ? 'not-allowed' : 'pointer',
              opacity: refreshing || loading ? 0.5 : 1,
            }}
            aria-label="Refresh activity log"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: refreshing ? 'rotate(360deg)' : 'none', transition: refreshing ? 'transform 0.6s linear' : 'none' }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </header>

      <main className="page-content">
        {loading ? (
          <div style={styles.center}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          </div>
        ) : error ? (
          <div style={styles.errorBox}>{error}</div>
        ) : entries.length === 0 ? (
          <div style={styles.center}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No activity recorded yet.</p>
          </div>
        ) : (
          <>
            <div style={styles.feed}>
              {entries.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </div>

            {hasMore && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ marginTop: 16 }}
              >
                {loadingMore ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Loading…
                  </span>
                ) : 'Load more'}
              </button>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function ActivityRow({ entry }) {
  const { category, action, level, meta, userName, createdAt } = entry;
  const catColor = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.system;
  const lvlColor = LEVEL_COLORS[level] ?? LEVEL_COLORS.info;
  const label    = getLabel(category, action);
  const detail   = formatMeta(category, action, meta);
  const relTime  = formatTime(createdAt);
  const absTime  = formatAbsTime(createdAt);

  return (
    <div style={styles.row}>
      {/* Category chip */}
      <span style={{ ...styles.chip, background: catColor.bg, border: `1px solid ${catColor.border}`, color: catColor.text }}>
        {category}
      </span>

      {/* Main content */}
      <div style={styles.rowBody}>
        <span style={{ ...styles.label, color: lvlColor.color }}>{label}</span>
        {detail && <span style={styles.detail}> — {detail}</span>}
        {userName && <span style={styles.user}> · {userName}</span>}
      </div>

      {/* Timestamp */}
      <span title={absTime} style={styles.time}>{relTime}</span>
    </div>
  );
}

const styles = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  errorBox: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    fontSize: 'var(--font-size-sm)',
  },
  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '9px 0',
    borderBottom: '1px solid var(--color-border)',
  },
  chip: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: 4,
    minWidth: 52,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    fontSize: 'var(--font-size-sm)',
    wordBreak: 'break-word',
  },
  label: {
    fontWeight: 600,
  },
  detail: {
    color: 'var(--color-text-muted)',
    fontWeight: 400,
  },
  user: {
    color: 'var(--color-text-dim)',
    fontWeight: 400,
    fontSize: 'var(--font-size-xs)',
  },
  time: {
    flexShrink: 0,
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-dim)',
    whiteSpace: 'nowrap',
  },
};
