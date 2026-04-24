import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoiceSettings, updateInvoiceSettings } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

export default function AdminInvoiceSettingsPage() {
  const navigate = useNavigate();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);

  const [taxEnabled,     setTaxEnabled]     = useState(false);
  const [taxName,        setTaxName]        = useState('GST');
  const [taxRate,        setTaxRate]        = useState('10');
  const [taxCalculation, setTaxCalculation] = useState('exclusive');

  useEffect(() => {
    getInvoiceSettings()
      .then((data) => {
        setTaxEnabled(data.taxEnabled ?? false);
        setTaxName(data.taxName ?? 'GST');
        setTaxRate(String(data.taxRate ?? 10));
        setTaxCalculation(data.taxCalculation ?? 'exclusive');
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    const rate = parseFloat(taxRate);
    if (taxEnabled && (isNaN(rate) || rate < 0 || rate > 100)) {
      setError('Tax rate must be between 0 and 100.');
      return;
    }
    if (taxEnabled && !taxName.trim()) {
      setError('Tax name is required when tax is enabled.');
      return;
    }
    setSaving(true);
    try {
      await updateInvoiceSettings({
        taxEnabled,
        taxName:        taxName.trim(),
        taxRate:        rate,
        taxCalculation,
      });
      setSuccess(true);
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div style={styles.headerRow}>
          <button type="button" onClick={() => navigate('/admin')} style={styles.backBtn} aria-label="Back">
            <ChevronLeft />
          </button>
          <h1 style={styles.headerTitle}>Invoice Settings</h1>
          <span style={{ width: 40 }} />
        </div>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map((n) => <div key={n} style={styles.skeleton} />)}
          </div>
        ) : (
          <>
            {/* Tax toggle */}
            <div className="card" style={styles.section}>
              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.fieldLabel}>Enable Tax on Invoices</p>
                  <p style={styles.fieldDesc}>Adds a tax line item to every invoice created from the app</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={taxEnabled}
                  onClick={() => { setTaxEnabled((v) => !v); setSuccess(false); }}
                  style={{ ...styles.toggle, ...(taxEnabled ? styles.toggleOn : styles.toggleOff) }}
                >
                  <span style={{ ...styles.toggleThumb, transform: taxEnabled ? 'translateX(20px)' : 'translateX(2px)' }} />
                </button>
              </div>
            </div>

            {/* Tax details — only shown when enabled */}
            {taxEnabled && (
              <div className="card" style={styles.section}>
                <p style={styles.sectionHeader}>Tax Details</p>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Tax Name</label>
                  <input
                    type="text"
                    value={taxName}
                    onChange={(e) => { setTaxName(e.target.value); setSuccess(false); }}
                    placeholder="e.g. GST, Sales Tax, VAT"
                    style={styles.input}
                    disabled={saving}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Tax Rate (%)</label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => { setTaxRate(e.target.value); setSuccess(false); }}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 10"
                    style={styles.input}
                    disabled={saving}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Calculation</label>
                  <div style={styles.segmentRow}>
                    {['exclusive', 'inclusive'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => { setTaxCalculation(opt); setSuccess(false); }}
                        style={{
                          ...styles.segment,
                          ...(taxCalculation === opt ? styles.segmentActive : styles.segmentInactive),
                        }}
                        disabled={saving}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p style={styles.fieldDesc}>
                    {taxCalculation === 'exclusive'
                      ? 'Tax is added on top of item price'
                      : 'Tax is included within item price'}
                  </p>
                </div>
              </div>
            )}

            {error   && <div style={styles.errorBanner}>{error}</div>}
            {success && <div style={styles.successBanner}>Settings saved.</div>}

            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%' }}
            >
              {saving
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />Saving…</span>
                : 'Save Settings'}
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

const styles = {
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 'var(--font-size-lg)',
    fontWeight: 800,
    color: 'var(--color-text)',
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
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 16,
  },
  sectionHeader: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggle: {
    position: 'relative',
    width: 44,
    height: 26,
    borderRadius: 13,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.2s',
    padding: 0,
    overflow: 'hidden',
  },
  toggleOn:  { backgroundColor: 'var(--color-primary)' },
  toggleOff: { backgroundColor: 'var(--color-border)' },
  toggleThumb: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  fieldDesc: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
  input: {
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-sm)',
    padding: '9px 12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  segmentRow: {
    display: 'flex',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
  },
  segment: {
    flex: 1,
    padding: '8px 0',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  },
  segmentActive:   { backgroundColor: 'var(--color-primary)', color: '#fff' },
  segmentInactive: { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' },
  errorBanner: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
  },
  successBanner: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    backgroundColor: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80',
  },
};
