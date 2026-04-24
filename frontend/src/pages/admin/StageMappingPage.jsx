import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStages, setStages } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

/**
 * StageMappingPage
 *
 * Lets an admin map each GHL pipeline stage to a crew job status.
 * If no pipeline is selected the page shows a prompt to configure one first.
 */

const JOB_STATUSES = [
  { value: '',            label: '(none)' },
  { value: 'assigned',   label: 'Assigned' },
  { value: 'enroute',    label: 'En Route' },
  { value: 'arrived',    label: 'Arrived' },
  { value: 'in_progress',label: 'In Progress' },
  { value: 'completed',  label: 'Completed' },
  { value: 'cancelled',  label: 'Cancelled' },
];

const STATUS_COLORS = {
  assigned:    'var(--status-assigned)',
  enroute:     'var(--status-enroute)',
  arrived:     'var(--status-arrived)',
  in_progress: 'var(--status-in-progress)',
  completed:   'var(--status-completed)',
  cancelled:   'var(--status-cancelled)',
};

export default function StageMappingPage() {
  const navigate = useNavigate();

  const [stages,      setStagesState] = useState([]);
  const [pipelineId,  setPipelineId]  = useState(null);
  const [mappings,    setMappings]    = useState({});   // { [stageId]: jobStatus }
  const [loadState,   setLoadState]   = useState({ loading: true, error: null });
  const [saveState,   setSaveState]   = useState({ loading: false, result: null, error: null });

  /* ---- Load stages on mount ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getStages();
        if (cancelled) return;

        const stageList = data.stages ?? [];
        setPipelineId(data.pipelineId ?? null);
        setStagesState(stageList);

        // Build initial mapping state from existing mappings on each stage
        const initial = {};
        stageList.forEach((s) => {
          initial[s.stage_id] = s.job_status ?? '';
        });
        setMappings(initial);
        setLoadState({ loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setLoadState({ loading: false, error: err?.response?.data?.message ?? 'Failed to load stages.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- Handle select change for a stage ---- */
  const handleMappingChange = (stageId, value) => {
    setMappings((prev) => ({ ...prev, [stageId]: value }));
    // Clear save feedback when user makes changes
    setSaveState({ loading: false, result: null, error: null });
  };

  /* ---- Save handler ---- */
  const handleSave = async () => {
    setSaveState({ loading: true, result: null, error: null });
    const mappingArray = Object.entries(mappings).map(([stageId, jobStatus]) => ({
      stageId,
      jobStatus: jobStatus || null,
    }));
    try {
      const data = await setStages(mappingArray);
      setSaveState({ loading: false, result: data, error: null });
    } catch (err) {
      setSaveState({ loading: false, result: null, error: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  /* ---- Counts ---- */
  const mappedCount   = Object.values(mappings).filter(Boolean).length;
  const unmappedCount = stages.length - mappedCount;

  /* ---- Render ---- */
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
          <h1 style={styles.headerTitle}>Stage Mapping</h1>
          <span style={{ width: 40 }} />
        </div>
      </header>

      {/* Content */}
      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Loading skeleton */}
        {loadState.loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={styles.skeleton} aria-hidden="true" />
            ))}
          </div>
        )}

        {/* Load error */}
        {loadState.error && (
          <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
            {loadState.error}
          </div>
        )}

        {/* No pipeline selected */}
        {!loadState.loading && !loadState.error && !pipelineId && (
          <div style={styles.noPipelineBox}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <p style={{ fontWeight: 700, color: 'var(--color-text-muted)', marginTop: 12 }}>
              No pipeline selected
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-dim)', marginTop: 4 }}>
              Set up a pipeline before mapping stages.
            </p>
            <Link to="/admin/pipeline" style={styles.noPipelineLink}>
              Go to Pipeline Setup
            </Link>
          </div>
        )}

        {/* Stage list */}
        {!loadState.loading && pipelineId && stages.length === 0 && (
          <div style={styles.noPipelineBox}>
            <p style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>No stages found</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-dim)', marginTop: 4 }}>
              The selected pipeline has no stages.
            </p>
          </div>
        )}

        {!loadState.loading && pipelineId && stages.length > 0 && (
          <>
            {/* Count pill summary */}
            <div style={styles.countRow}>
              <span style={{ ...styles.countPill, ...styles.countPillMapped }}>
                {mappedCount} mapped
              </span>
              {unmappedCount > 0 && (
                <span style={{ ...styles.countPill, ...styles.countPillUnmapped }}>
                  {unmappedCount} unmapped
                </span>
              )}
            </div>

            {/* Stage rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stages.map((stage) => {
                const currentStatus = mappings[stage.stage_id] ?? '';
                const isMapped      = !!currentStatus;
                const statusColor   = STATUS_COLORS[currentStatus];
                return (
                  <div key={stage.stage_id} className="card" style={styles.stageCard}>
                    <div style={styles.stageCardTop}>
                      {/* Mapped indicator dot */}
                      <span
                        aria-hidden="true"
                        style={{
                          ...styles.stageDot,
                          backgroundColor: isMapped ? statusColor : 'var(--color-text-dim)',
                        }}
                      />
                      <p style={styles.stageName}>{stage.stage_name}</p>
                    </div>
                    <select
                      value={currentStatus}
                      onChange={(e) => handleMappingChange(stage.stage_id, e.target.value)}
                      style={{
                        ...styles.stageSelect,
                        ...(isMapped ? { borderColor: statusColor, color: statusColor } : {}),
                      }}
                      aria-label={`Map stage ${stage.stage_name}`}
                    >
                      {JOB_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Save feedback */}
            {saveState.result && (
              <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
                {saveState.result.updated ?? stages.length} stage mapping{saveState.result.updated !== 1 ? 's' : ''} saved.
              </div>
            )}
            {saveState.error && (
              <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
                {saveState.error}
              </div>
            )}

            {/* Save button */}
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saveState.loading}
            >
              {saveState.loading ? (
                <span style={styles.btnInner}>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Saving…
                </span>
              ) : 'Save Mappings'}
            </button>
          </>
        )}

      </main>

      <BottomNav />
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
    flex: 1,
    fontSize: 'var(--font-size-lg)',
    fontWeight: 800,
    color: 'var(--color-text)',
    textAlign: 'center',
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
  skeleton: {
    height: 80,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-surface)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  noPipelineBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '40px 16px',
  },
  noPipelineLink: {
    display: 'inline-block',
    marginTop: 16,
    padding: '10px 20px',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 'var(--font-size-sm)',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
  },
  countRow: {
    display: 'flex',
    gap: 8,
  },
  countPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
  },
  countPillMapped: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    color: '#4ade80',
    border: '1px solid rgba(34,197,94,0.25)',
  },
  countPillUnmapped: {
    backgroundColor: 'rgba(136,136,170,0.12)',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
  },
  stageCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  stageCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background-color var(--transition-fast)',
  },
  stageName: {
    fontWeight: 600,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
    flex: 1,
  },
  stageSelect: {
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundColor: 'var(--color-surface-2)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-muted)',
    padding: '10px 14px',
    width: '100%',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color var(--transition-fast), color var(--transition-fast)',
    fontFamily: 'inherit',
  },
  feedbackBanner: {
    padding: '10px 14px',
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
