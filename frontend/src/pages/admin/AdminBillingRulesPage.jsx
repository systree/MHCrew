import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getBillingRules, updateBillingRules } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

export default function AdminBillingRulesPage() {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);

  const [billingRulesEnabled,   setBillingRulesEnabled]   = useState(false);
  const [calloutMinutes,        setCalloutMinutes]        = useState(30);
  const [partialPaymentEnabled, setPartialPaymentEnabled] = useState(false);

  useEffect(() => {
    getBillingRules()
      .then((data) => {
        setBillingRulesEnabled(data.billingRulesEnabled   ?? false);
        setCalloutMinutes(data.calloutMinutes             ?? 30);
        setPartialPaymentEnabled(data.partialPaymentEnabled ?? false);
      })
      .catch(() => setError('Failed to load billing rules.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateBillingRules({
        billingRulesEnabled,
        calloutMinutes:   Number(calloutMinutes),
        partialPaymentEnabled,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to save billing rules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            aria-label="Back to admin"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>Billing Rules</h1>
        </div>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ height: 72, borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)' }} />
            ))}
          </div>
        ) : (
          <>
            {error && (
              <div style={styles.errorBanner}>{error}</div>
            )}
            {success && (
              <div style={styles.successBanner}>Billing rules saved.</div>
            )}

            {/* Enable billing rules */}
            <div style={styles.card}>
              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>Enable Billing Rules</p>
                  <p style={styles.toggleDesc}>
                    When enabled, invoice creation shows job-type-specific helpers (door-to-door callout, depot-to-depot hours).
                    When disabled, existing behaviour is unchanged for all tenants.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={billingRulesEnabled}
                  onClick={() => setBillingRulesEnabled((v) => !v)}
                  style={{ ...styles.toggle, ...(billingRulesEnabled ? styles.toggleOn : styles.toggleOff) }}
                >
                  <span style={{ ...styles.toggleKnob, transform: billingRulesEnabled ? 'translateX(20px)' : 'translateX(2px)' }} />
                </button>
              </div>
            </div>

            {/* Callout minutes — only relevant when billing rules on */}
            <div style={{ ...styles.card, opacity: billingRulesEnabled ? 1 : 0.5 }}>
              <label style={styles.fieldLabel}>Door-to-Door Callout (minutes)</label>
              <p style={styles.fieldDesc}>Added automatically to door-to-door job invoices as a client charge.</p>
              <input
                type="number"
                value={calloutMinutes}
                onChange={(e) => setCalloutMinutes(e.target.value)}
                min="0"
                step="5"
                disabled={!billingRulesEnabled || saving}
                style={styles.input}
              />
            </div>

            {/* Partial payment */}
            <div style={styles.card}>
              <div style={styles.toggleRow}>
                <div>
                  <p style={styles.toggleLabel}>Partial Payments (Interstate)</p>
                  <p style={styles.toggleDesc}>
                    Adds a 1/3–1/3–1/3 payment schedule to new invoices for large jobs.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={partialPaymentEnabled}
                  onClick={() => setPartialPaymentEnabled((v) => !v)}
                  style={{ ...styles.toggle, ...(partialPaymentEnabled ? styles.toggleOn : styles.toggleOff) }}
                >
                  <span style={{ ...styles.toggleKnob, transform: partialPaymentEnabled ? 'translateX(20px)' : 'translateX(2px)' }} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={handleSave}
              style={{ width: '100%', fontSize: 'var(--font-size-md)' }}
            >
              {saving
                ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                : 'Save'}
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: 'var(--color-text)',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    lineHeight: 1.4,
    maxWidth: 240,
  },
  toggle: {
    position: 'relative',
    width: 44,
    height: 26,
    borderRadius: 13,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    transition: 'background 0.2s',
  },
  toggleOn: {
    backgroundColor: 'var(--color-primary)',
  },
  toggleOff: {
    backgroundColor: 'var(--color-border)',
  },
  toggleKnob: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
    display: 'block',
  },
  fieldLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  fieldDesc: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    lineHeight: 1.4,
    marginTop: -4,
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
    color: 'var(--status-completed)',
  },
};
