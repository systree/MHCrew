import React, { useState, useEffect, useRef, useCallback } from 'react';
import { timesheetApi } from '../services/api.js';

/**
 * TimeTracker
 *
 * Self-contained time tracking widget embedded in JobDetailPage.
 * Manages its own API calls and all timer state locally.
 *
 * Props:
 *   jobId      {string|number}  — the job to track time against
 *   jobStatus  {string}         — current job status (used to decide visibility)
 */

const TRACKABLE_STATUSES = new Set(['arrived', 'in_progress', 'completed']);

/** Format a total number of seconds as HH:MM:SS */
function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}


export default function TimeTracker({ jobId, jobStatus }) {
  // --- Clock state ---
  const [status, setStatus] = useState('idle'); // 'idle' | 'clocked_in' | 'on_break' | 'clocked_out'
  const [clockInTime, setClockInTime] = useState(null);   // Date object
  const [breakStartTime, setBreakStartTime] = useState(null); // Date object, set when break starts
  const [accumulatedBreakMs, setAccumulatedBreakMs] = useState(0); // ms of completed breaks

  // --- Live timer display ---
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);

  // --- Summary shown after clock-out ---
  const [summary, setSummary] = useState(null); // { totalMinutes, breakMinutes }

  // --- Loading / error ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Refs for interval IDs so cleanup works correctly
  const elapsedIntervalRef = useRef(null);
  const breakIntervalRef = useRef(null);

  // --- Load existing active timesheet on mount ---
  useEffect(() => {
    if (!TRACKABLE_STATUSES.has(jobStatus)) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await timesheetApi.getTimesheets(jobId);
        const timesheets = data?.timesheets ?? [];

        if (!cancelled && timesheets.length > 0) {
          // Find an active (no clock_out) timesheet
          const active = timesheets.find((t) => t.clock_in && !t.clock_out);
          if (active) {
            const cin = new Date(active.clock_in);
            setClockInTime(cin);
            setAccumulatedBreakMs((active.break_minutes ?? 0) * 60000);
            setStatus('clocked_in');
          } else {
            // Check if the latest one is completed
            const last = timesheets[timesheets.length - 1];
            if (last?.clock_out) {
              setSummary({
                totalMinutes: last.total_minutes ?? 0,
                breakMinutes: last.break_minutes ?? 0,
              });
              setStatus('clocked_out');
            }
          }
        }
      } catch {
        // Silently ignore load errors — user can still clock in manually
      }
    })();

    return () => { cancelled = true; };
  }, [jobId, jobStatus]);

  // --- Elapsed (work) timer — ticks every second while clocked in or on break ---
  useEffect(() => {
    if (status === 'clocked_in' || status === 'on_break') {
      elapsedIntervalRef.current = setInterval(() => {
        if (!clockInTime) return;
        const nowMs = Date.now();
        const totalMs = nowMs - clockInTime.getTime();
        // Subtract all break time (completed breaks + current break in progress)
        const currentBreakMs =
          status === 'on_break' && breakStartTime
            ? nowMs - breakStartTime.getTime()
            : 0;
        const workedMs = totalMs - accumulatedBreakMs - currentBreakMs;
        setElapsedSeconds(Math.max(0, Math.floor(workedMs / 1000)));
      }, 1000);
    }

    return () => {
      clearInterval(elapsedIntervalRef.current);
    };
  }, [status, clockInTime, accumulatedBreakMs, breakStartTime]);

  // --- Break timer — ticks every second while on break ---
  useEffect(() => {
    if (status === 'on_break' && breakStartTime) {
      breakIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - breakStartTime.getTime()) / 1000);
        setBreakElapsedSeconds(Math.max(0, elapsed));
      }, 1000);
    } else {
      setBreakElapsedSeconds(0);
    }

    return () => {
      clearInterval(breakIntervalRef.current);
    };
  }, [status, breakStartTime]);

  // --- Handlers ---

  const handleStartBreak = useCallback(() => {
    setBreakStartTime(new Date());
    setStatus('on_break');
  }, []);

  const handleEndBreak = useCallback(async () => {
    setError('');
    if (!breakStartTime) return;

    const breakMs = Date.now() - breakStartTime.getTime();
    const breakMins = msToMinutes(breakMs);

    setLoading(true);
    try {
      await timesheetApi.endBreak(jobId, breakMins);
      setAccumulatedBreakMs((prev) => prev + breakMs);
      setBreakStartTime(null);
      setStatus('clocked_in');
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to end break. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [jobId, breakStartTime]);


  // --- Don't render for irrelevant statuses ---
  if (!TRACKABLE_STATUSES.has(jobStatus)) return null;

  return (
    <div style={styles.card}>
      {/* Section header */}
      <p style={styles.sectionLabel}>Time Tracking</p>

      <div style={styles.body}>
        {/* Status pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <StatusPill status={status} />
          {(status === 'clocked_in' || status === 'on_break') && (
            <span style={styles.elapsedDisplay}>{formatElapsed(elapsedSeconds)}</span>
          )}
        </div>

        {/* Break sub-timer */}
        {status === 'on_break' && (
          <div style={styles.breakTimer}>
            <span style={styles.breakTimerLabel}>Break in progress</span>
            <span style={styles.breakTimerValue}>{formatElapsed(breakElapsedSeconds)}</span>
          </div>
        )}

        {/* Error */}
        {error && <p style={styles.errorText}>{error}</p>}

        {/* Summary after clock-out */}
        {status === 'clocked_out' && summary && (
          <div style={styles.summaryBox}>
            <SummaryRow label="Total worked" value={formatDuration(summary.totalMinutes)} />
            <SummaryRow label="Break time" value={formatDuration(summary.breakMinutes)} />
          </div>
        )}

        {/* Action buttons */}
        <div style={styles.actions}>
          {/* Start Break / End Break */}
          {status === 'clocked_in' && (
            <ActionButton
              label="Start Break"
              icon={breakIcon}
              color="var(--color-text-muted)"
              variant="secondary"
              onClick={handleStartBreak}
              loading={loading}
            />
          )}

          {status === 'on_break' && (
            <ActionButton
              label="End Break"
              icon={breakIcon}
              color="var(--color-text-muted)"
              variant="secondary"
              onClick={handleEndBreak}
              loading={loading}
            />
          )}

        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatusPill({ status }) {
  const map = {
    idle:        { label: 'Not started',  bg: 'rgba(148,163,184,0.15)', color: 'var(--color-text-muted)' },
    clocked_in:  { label: 'Clocked in',   bg: 'rgba(34,197,94,0.15)',   color: 'var(--status-completed)' },
    on_break:    { label: 'On break',      bg: 'rgba(251,191,36,0.15)',  color: '#d97706' },
    clocked_out: { label: 'Clocked out',  bg: 'rgba(148,163,184,0.15)', color: 'var(--color-text-muted)' },
  };
  const { label, bg, color } = map[status] ?? map.idle;
  return (
    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, backgroundColor: bg, color }}>
      {label}
    </span>
  );
}

function ActionButton({ label, icon, color, variant, onClick, loading }) {
  const isSecondary = variant === 'secondary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        border: isSecondary ? `1px solid var(--color-border)` : 'none',
        backgroundColor: isSecondary ? 'var(--color-surface-2)' : color,
        color: isSecondary ? color : '#fff',
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? (
        <span style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)' }}>{value || '0m'}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function msToMinutes(ms) {
  return Math.round(ms / 60000);
}

function formatDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ------------------------------------------------------------------ */
/*  Icons                                                               */
/* ------------------------------------------------------------------ */

const breakIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = {
  card: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '10px 16px 8px',
    borderBottom: '1px solid var(--color-border)',
  },
  body: {
    padding: '12px 16px 14px',
  },
  elapsedDisplay: {
    fontFamily: 'monospace',
    fontSize: 'var(--font-size-lg, 1.125rem)',
    fontWeight: 700,
    color: 'var(--status-completed)',
    letterSpacing: '0.04em',
  },
  breakTimer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    marginBottom: 12,
  },
  breakTimerLabel: {
    fontSize: 'var(--font-size-xs)',
    color: '#d97706',
    fontWeight: 600,
  },
  breakTimerValue: {
    fontFamily: 'monospace',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: '#d97706',
  },
  summaryBox: {
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--status-cancelled)',
    marginBottom: 8,
  },
};
