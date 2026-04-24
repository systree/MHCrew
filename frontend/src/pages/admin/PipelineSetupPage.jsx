import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPipelines, setPipeline } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

/**
 * PipelineSetupPage
 *
 * Lets an admin choose which GHL pipeline the crew app monitors.
 * Loads the list of pipelines on mount and highlights the current selection.
 */
export default function PipelineSetupPage() {
  const navigate = useNavigate();

  const [pipelines,          setPipelines]          = useState([]);
  const [currentPipelineId,  setCurrentPipelineId]  = useState(null);
  const [selectedId,         setSelectedId]         = useState(null);
  const [loadState,          setLoadState]          = useState({ loading: true, error: null });
  const [saveState,          setSaveState]          = useState({ loading: false, result: null, error: null });

  /* ---- Load pipelines on mount ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPipelines();
        if (cancelled) return;
        setPipelines(data.pipelines ?? []);
        setCurrentPipelineId(data.currentPipelineId ?? null);
        setSelectedId(data.currentPipelineId ?? null);
        setLoadState({ loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setLoadState({ loading: false, error: err?.response?.data?.message ?? 'Failed to load pipelines.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- Save handler ---- */
  const handleSave = async () => {
    if (!selectedId) return;
    setSaveState({ loading: true, result: null, error: null });
    try {
      const data = await setPipeline(selectedId);
      setCurrentPipelineId(selectedId);
      setSaveState({ loading: false, result: data, error: null });
    } catch (err) {
      setSaveState({ loading: false, result: null, error: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  /* ---- Derived state ---- */
  const isDirty    = selectedId !== currentPipelineId;
  const canSave    = !!selectedId && isDirty && !saveState.loading;

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
          <h1 style={styles.headerTitle}>Pipeline Setup</h1>
          <span style={{ width: 40 }} /> {/* spacer to centre title */}
        </div>
      </header>

      {/* Content */}
      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Info note */}
        <div style={styles.infoBox}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: 'var(--font-size-sm)', color: '#93c5fd', lineHeight: 1.5 }}>
            Selecting a pipeline will import all its stages for mapping.
          </p>
        </div>

        {/* Loading skeleton */}
        {loadState.loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((n) => (
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

        {/* Pipeline list */}
        {!loadState.loading && !loadState.error && pipelines.length === 0 && (
          <div style={styles.emptyState}>
            <p style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>No pipelines found</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-dim)', marginTop: 4 }}>
              Make sure your GHL account is connected.
            </p>
          </div>
        )}

        {!loadState.loading && pipelines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pipelines.map((pipeline) => {
              const isSelected = pipeline.id === selectedId;
              const isCurrent  = pipeline.id === currentPipelineId;
              return (
                <button
                  key={pipeline.id}
                  type="button"
                  onClick={() => setSelectedId(pipeline.id)}
                  style={{
                    ...styles.pipelineRow,
                    ...(isSelected ? styles.pipelineRowSelected : {}),
                  }}
                >
                  {/* Radio dot */}
                  <span style={{
                    ...styles.radioDot,
                    ...(isSelected ? styles.radioDotSelected : {}),
                  }}>
                    {isSelected && <span style={styles.radioDotInner} />}
                  </span>

                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <span style={styles.pipelineName}>{pipeline.name}</span>
                    {isCurrent && (
                      <span style={styles.currentBadge}>Current</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Save feedback */}
        {saveState.result && (
          <div style={{ ...styles.feedbackBanner, ...styles.feedbackSuccess }}>
            Pipeline saved successfully.
          </div>
        )}
        {saveState.error && (
          <div style={{ ...styles.feedbackBanner, ...styles.feedbackError }}>
            {saveState.error}
          </div>
        )}

        {/* Save button */}
        {!loadState.loading && pipelines.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            {saveState.loading ? (
              <span style={styles.btnInner}>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Saving…
              </span>
            ) : 'Save Pipeline'}
          </button>
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
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(59,130,246,0.1)',
    border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
  },
  skeleton: {
    height: 60,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-surface)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 0',
  },
  pipelineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
    width: '100%',
    textAlign: 'left',
    color: 'var(--color-text)',
  },
  pipelineRowSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'rgba(233,69,96,0.06)',
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '2px solid var(--color-border)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color var(--transition-fast)',
  },
  radioDotSelected: {
    borderColor: 'var(--color-primary)',
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: 'var(--color-primary)',
  },
  pipelineName: {
    fontWeight: 600,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
    display: 'block',
  },
  currentBadge: {
    display: 'inline-block',
    marginTop: 4,
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    backgroundColor: 'rgba(34,197,94,0.15)',
    color: '#4ade80',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 'var(--radius-full)',
    padding: '2px 8px',
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
