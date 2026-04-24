import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsApi, invoicesApi, timesheetApi } from '../services/api.js';
import { getInvoiceSettings } from '../services/adminApi.js';
import { formatCurrency } from '../utils/formatters.js';
import BottomNav from '../components/BottomNav.jsx';

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function CreateInvoicePage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [job,       setJob]       = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [title,   setTitle]   = useState('');
  const [items,   setItems]   = useState([{ name: '', qty: '1', unitPrice: '' }]);
  const [dueDate, setDueDate] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [tax,     setTax]     = useState(null); // { taxEnabled, taxName, taxRate }

  // Load job + timesheets in parallel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [jobRes, tsRes, taxRes] = await Promise.allSettled([
          jobsApi.getJobById(id),
          timesheetApi.getTimesheets(id),
          getInvoiceSettings(),
        ]);

        if (cancelled) return;

        if (jobRes.status === 'rejected') {
          setLoadError('Failed to load job details.');
          setLoading(false);
          return;
        }

        const loadedJob = jobRes.value.data?.job ?? jobRes.value.data;
        setJob(loadedJob);
        setTitle(`Moving Services – ${loadedJob.customer_name ?? 'Customer'}`);

        if (taxRes.status === 'fulfilled') setTax(taxRes.value);

        // Time suggestion: only when completed and timesheets exist
        if (loadedJob.status === 'completed' && tsRes.status === 'fulfilled') {
          const timesheets = tsRes.value.data?.timesheets ?? [];
          const totalMinutes = timesheets.reduce((sum, t) => sum + (t.total_minutes ?? 0), 0);
          if (totalMinutes > 0) {
            setItems([{ name: `Moving Service (${formatDuration(totalMinutes)})`, qty: '1', unitPrice: '' }]);
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError('Failed to load job details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { name: '', qty: '1', unitPrice: '' }]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const subtotal = items.reduce((sum, it) => {
    const qty   = parseFloat(it.qty)       || 0;
    const price = parseFloat(it.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const taxAmount = (tax?.taxEnabled && tax?.taxRate > 0)
    ? subtotal * (tax.taxRate / 100)
    : 0;
  const total = subtotal + taxAmount;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Invoice title is required.'); return; }
    if (items.some((it) => !it.name.trim())) { setError('Each item needs a description.'); return; }
    if (items.some((it) => !it.qty || parseFloat(it.qty) <= 0)) { setError('Each item needs a valid quantity.'); return; }
    if (items.some((it) => it.unitPrice === '' || parseFloat(it.unitPrice) < 0)) { setError('Each item needs a valid unit price.'); return; }

    setSaving(true);
    try {
      await invoicesApi.createInvoice(id, {
        title: title.trim(),
        items: items.map((it) => ({
          name:      it.name.trim(),
          quantity:  parseFloat(it.qty),
          unitPrice: parseFloat(it.unitPrice),
        })),
        ...(dueDate ? { dueDate } : {}),
      });
      navigate(`/jobs/${id}`, { state: { invoiceSent: true } });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to send invoice. Please try again.');
      setSaving(false);
    }
  }, [id, title, items, dueDate, navigate]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <div style={styles.headerRow}>
            <button type="button" onClick={() => navigate(`/jobs/${id}`)} style={styles.backBtn} aria-label="Back">
              <ChevronLeft />
            </button>
            <h1 style={styles.headerTitle}>Send Invoice</h1>
            <span style={{ width: 40 }} />
          </div>
        </header>
        <main className="page-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((n) => <div key={n} style={styles.skeleton} aria-hidden="true" />)}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page">
        <header className="page-header">
          <div style={styles.headerRow}>
            <button type="button" onClick={() => navigate(`/jobs/${id}`)} style={styles.backBtn} aria-label="Back">
              <ChevronLeft />
            </button>
            <h1 style={styles.headerTitle}>Send Invoice</h1>
            <span style={{ width: 40 }} />
          </div>
        </header>
        <main className="page-content">
          <div style={styles.errorBanner}>{loadError}</div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={styles.headerRow}>
          <button type="button" onClick={() => navigate(`/jobs/${id}`)} style={styles.backBtn} aria-label="Back to job">
            <ChevronLeft />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={styles.headerTitle}>Send Invoice</h1>
            {job?.customer_name && (
              <p style={styles.headerSub}>{job.customer_name}</p>
            )}
          </div>
          <span style={{ width: 40 }} />
        </div>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Invoice title */}
          <div className="card" style={styles.section}>
            <label style={styles.label}>Invoice Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Moving Services"
              style={styles.input}
              disabled={saving}
            />
          </div>

          {/* Line items */}
          <div className="card" style={styles.section}>
            <p style={styles.sectionHeader}>Line Items</p>

            {/* Column headers */}
            <div style={styles.itemHeaderRow}>
              <span style={{ flex: 1 }}>Description</span>
              <span style={styles.itemQtyHeader}>Qty</span>
              <span style={styles.itemPriceHeader}>Unit Price</span>
              <span style={{ width: 28 }} />
            </div>

            {items.map((it, i) => (
              <div key={i} style={styles.itemRow}>
                <input
                  type="text"
                  value={it.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  placeholder="Description"
                  style={{ ...styles.input, flex: 1, minWidth: 0, width: 'auto' }}
                  disabled={saving}
                />
                <input
                  type="number"
                  value={it.qty}
                  onChange={(e) => updateItem(i, 'qty', e.target.value)}
                  min="0.01"
                  step="0.01"
                  placeholder="1"
                  style={{ ...styles.input, ...styles.itemQtyInput }}
                  disabled={saving}
                />
                <input
                  type="number"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  style={{ ...styles.input, ...styles.itemPriceInput }}
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1 || saving}
                  style={styles.removeBtn}
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              disabled={saving}
              style={styles.addItemBtn}
            >
              + Add Item
            </button>

            {/* Tax + total */}
            {tax?.taxEnabled && tax?.taxRate > 0 && (
              <>
                <div style={{ ...styles.totalRow, borderTop: 'none', paddingTop: 6, marginTop: 0 }}>
                  <span style={styles.totalLabel}>Subtotal</span>
                  <span style={{ ...styles.totalAmount, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                </div>
                <div style={{ ...styles.totalRow, borderTop: 'none', paddingTop: 2, marginTop: 0 }}>
                  <span style={styles.totalLabel}>{tax.taxName} ({tax.taxRate}%)</span>
                  <span style={{ ...styles.totalAmount, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{formatCurrency(taxAmount)}</span>
                </div>
              </>
            )}
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Total</span>
              <span style={styles.totalAmount}>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Due date */}
          <div className="card" style={styles.section}>
            <label style={styles.label}>Due Date <span style={styles.optional}>(optional)</span></label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={styles.input}
              disabled={saving}
            />
          </div>

          {/* Error */}
          {error && <div style={styles.errorBanner}>{error}</div>}

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ width: '100%', fontSize: 'var(--font-size-md)' }}
          >
            {saving
              ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : 'Send Invoice'}
          </button>

        </form>
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
  skeleton: {
    height: 80,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-surface)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 16,
  },
  sectionHeader: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  label: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  optional: {
    fontWeight: 400,
    color: 'var(--color-text-dim)',
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
  itemHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--color-text-dim)',
    paddingBottom: 2,
  },
  itemQtyHeader: {
    width: 52,
    flexShrink: 0,
    textAlign: 'center',
  },
  itemPriceHeader: {
    width: 80,
    flexShrink: 0,
    textAlign: 'right',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  itemQtyInput: {
    width: 52,
    flex: 'none',
    padding: '9px 6px',
    textAlign: 'center',
  },
  itemPriceInput: {
    width: 80,
    flex: 'none',
    padding: '9px 8px',
    textAlign: 'right',
  },
  removeBtn: {
    width: 28,
    height: 28,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-dim)',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    padding: 0,
  },
  addItemBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-primary)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 0',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTop: '1px solid var(--color-border)',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  totalAmount: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 800,
    color: 'var(--color-text)',
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
};
