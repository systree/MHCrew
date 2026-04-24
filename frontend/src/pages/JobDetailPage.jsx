import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { jobsApi, timesheetApi, invoicesApi } from '../services/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import BottomNav from '../components/BottomNav.jsx';
import TimeTracker from '../components/TimeTracker.jsx';
import PhotoCapture from '../components/PhotoCapture.jsx';
import { formatDate, formatDateTime, formatPhone, formatCurrency, shortAddress } from '../utils/formatters.js';
import { useGPS } from '../hooks/useGPS.js';
import useAuthStore from '../store/authStore.js';

/**
 * JobDetailPage
 *
 * Displays the full detail of a single job and allows the crew member to
 * progress the job through its lifecycle:
 *   assigned → enroute → arrived → in_progress → completed | cancelled
 */

// ---------------------------------------------------------------------------
// current location → pickup (omit origin so Maps uses device GPS)
function buildPickupUrl(pickup) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup)}&travelmode=driving`;
}

// pickup → dropoff
function buildDropoffUrl(pickup, dropoff) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}&travelmode=driving`;
}

// Invoice status config
// ---------------------------------------------------------------------------
const INV_STATUS_LABELS = {
  draft:           'Draft',
  sent:            'Sent',
  viewed:          'Viewed',
  partially_paid:  'Part Paid',
  paid:            'Paid',
};

const INV_STATUS_STYLES = {
  draft:          { backgroundColor: 'rgba(136,136,170,0.12)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' },
  sent:           { backgroundColor: 'rgba(59,130,246,0.12)',  color: '#60a5fa',                 border: '1px solid rgba(59,130,246,0.3)' },
  viewed:         { backgroundColor: 'rgba(59,130,246,0.12)',  color: '#60a5fa',                 border: '1px solid rgba(59,130,246,0.3)' },
  partially_paid: { backgroundColor: 'rgba(234,179,8,0.12)',   color: '#facc15',                 border: '1px solid rgba(234,179,8,0.3)' },
  paid:           { backgroundColor: 'rgba(34,197,94,0.12)',   color: '#4ade80',                 border: '1px solid rgba(34,197,94,0.25)' },
  default:        { backgroundColor: 'rgba(136,136,170,0.12)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' },
};

// ---------------------------------------------------------------------------
// Status transition config
// ---------------------------------------------------------------------------
const TRANSITIONS = {
  assigned:    { next: 'enroute',      label: 'Start Driving', icon: '🚛' },
  enroute:     { next: 'arrived',      label: "I've Arrived",  icon: '📍' },
  arrived:     { next: 'in_progress',  label: 'Start Job',     icon: '⚡' },
  in_progress: { next: 'completed',    label: 'Complete Job',  icon: '✅' },
};

// ---------------------------------------------------------------------------
// Toast component — ephemeral success / error message
// ---------------------------------------------------------------------------
function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg   = 'var(--color-surface)';
  const bdr  = type === 'error' ? 'var(--status-cancelled)' : 'var(--status-completed)';
  const clr  = type === 'error' ? 'var(--status-cancelled)' : 'var(--status-completed)';

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: 340,
        width: 'calc(100% - 32px)',
        backgroundColor: bg,
        border: `1px solid ${bdr}`,
        borderRadius: 'var(--radius-lg)',
        color: clr,
        fontSize: 'var(--font-size-sm)',
        fontWeight: 600,
        padding: '12px 16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
      }}
      onClick={onDismiss}
    >
      <span style={{ flexShrink: 0 }}>{type === 'error' ? '✕' : '✓'}</span>
      <span style={{ flex: 1 }}>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal — used for "Complete Job" notes and "Cancel Job" reason
// ---------------------------------------------------------------------------
function ConfirmModal({ title, description, confirmLabel, onConfirm, onCancel, updating }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)', marginBottom: 8 }}>
          {title}
        </p>
        {description && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            {description}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel} disabled={updating}>
            Cancel
          </button>
          <button className="btn-danger" style={{ flex: 1 }} onClick={onConfirm} disabled={updating}>
            {updating
              ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionModal({ title, placeholder, confirmLabel, confirmStyle, onConfirm, onCancel, updating, requireInput }) {
  const [text, setText] = useState('');
  const canSubmit = !requireInput || text.trim().length > 0;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)', marginBottom: 12 }}>
          {title}
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={styles.textarea}
          autoFocus
        />
        {requireInput && text.trim().length === 0 && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--status-cancelled)', marginTop: 4 }}>
            This field is required.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={onCancel}
            disabled={updating}
          >
            Back
          </button>
          <button
            className={confirmStyle === 'danger' ? 'btn-danger' : 'btn-primary'}
            style={{ flex: 1 }}
            onClick={() => onConfirm(text.trim())}
            disabled={updating || !canSubmit}
          >
            {updating
              ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function JobDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const routeLocation = useLocation();

  const [job, setJob]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(false);
  const [error, setError]           = useState('');
  const [toast, setToast]           = useState(null); // { message, type }

  // Modal state: null | 'complete' | 'cancel' | 'confirm:<next_status>'
  const [modal, setModal] = useState(null);

  // Invoices — loaded independently after job data
  const [invoices,        setInvoices]        = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState(null); // invoice id
  const [sendingInvoice,  setSendingInvoice]  = useState(null); // invoice id being sent
  const [deletingInvoice,  setDeletingInvoice]  = useState(null); // invoice id being deleted
  const [confirmDeleteId,  setConfirmDeleteId]  = useState(null); // invoice id pending delete confirm

  // ---- GPS tracking — auto-captures on status changes ----
  const { permissionStatus } = useGPS(job?.id, job?.status);

  // ---- Fetch invoices helper ----
  const fetchInvoices = useCallback(() => {
    if (!id) return;
    setInvoicesLoading(true);
    invoicesApi.getInvoices(id)
      .then(({ data }) => setInvoices(data?.invoices ?? []))
      .catch(() => { /* non-critical — silently ignore */ })
      .finally(() => setInvoicesLoading(false));
  }, [id]);

  // ---- Fetch invoices once job is loaded ----
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // ---- Refresh invoices when returning from CreateInvoicePage ----
  useEffect(() => {
    if (routeLocation.state?.invoiceCreated) {
      fetchInvoices();
      setToast({ message: 'Invoice created successfully', type: 'success' });
      // Clear state so a back-navigation doesn't retrigger
      window.history.replaceState({}, '');
    }
  }, [routeLocation.state, fetchInvoices]);

  // ---- Fetch job ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await jobsApi.getJobById(id);
        if (!cancelled) setJob(data?.job ?? data);
      } catch (err) {
        if (!cancelled)
          setError(err.response?.data?.message ?? 'Failed to load job details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ---- Refresh job after a successful update ----
  const refreshJob = useCallback(async () => {
    try {
      const { data } = await jobsApi.getJobById(id);
      setJob(data?.job ?? data);
    } catch {
      // Non-critical — local state already updated optimistically
    }
  }, [id]);

  // ---- Live clock — ticks while the Start Job confirm modal is open ----
  const [liveTime, setLiveTime] = useState('');
  useEffect(() => {
    if (modal !== 'confirm:in_progress') return;
    const tick = () => {
      setLiveTime(new Date().toLocaleTimeString('en-AU', {
        timeZone: useAuthStore.getState().timezone ?? 'Australia/Sydney',
        hour:     '2-digit',
        minute:   '2-digit',
        second:   '2-digit',
        hour12:   true,
      }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [modal]);

  // ---- Dismiss toast ----
  const dismissToast = useCallback(() => setToast(null), []);

  // ---- Send an invoice ----
  const handleSendInvoice = useCallback(async (invoiceId) => {
    setSendingInvoice(invoiceId);
    try {
      await invoicesApi.sendInvoice(id, invoiceId);
      setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, status: 'sent' } : inv));
      setToast({ message: 'Invoice sent to client', type: 'success' });
    } catch {
      setToast({ message: 'Failed to send invoice', type: 'error' });
    } finally {
      setSendingInvoice(null);
    }
  }, [id]);

  // ---- Delete a draft invoice ----
  const handleDeleteInvoice = useCallback(async () => {
    const invoiceId = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingInvoice(invoiceId);
    try {
      await invoicesApi.deleteInvoice(id, invoiceId);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      setExpandedInvoice(null);
      setToast({ message: 'Invoice deleted', type: 'success' });
    } catch (err) {
      setToast({ message: err.response?.data?.error ?? 'Failed to delete invoice', type: 'error' });
    } finally {
      setDeletingInvoice(null);
    }
  }, [id, confirmDeleteId]);

  // ---- Handle a confirmed status transition ----
  const handleStatusUpdate = useCallback(async (newStatus, notes, cancellationReason) => {
    setModal(null);
    setUpdating(true);
    setError('');
    try {
      const { data } = await jobsApi.updateStatus(id, newStatus, notes || undefined, cancellationReason || undefined);

      // Auto clock-in when job starts
      if (newStatus === 'in_progress') {
        await timesheetApi.clockIn(id).catch((err) => {
          if (err.response?.status !== 409) {
            console.warn('Auto clock-in failed:', err.response?.data?.error ?? err.message);
          }
        });
      }

      // Auto clock-out when job completes — breakMinutes: 0 is safe because
      // each endBreak call already accumulated break time in the DB.
      if (newStatus === 'completed') {
        await timesheetApi.clockOut(id, 0).catch((err) => {
          // 404 = no active timesheet (crew never clocked in) — ignore
          if (err.response?.status !== 404) {
            console.warn('Auto clock-out failed:', err.response?.data?.error ?? err.message);
          }
        });
      }

      const updatedJob = data?.job ?? data;
      setJob((prev) => ({ ...prev, ...updatedJob }));
      setToast({ message: `Status updated to "${newStatus.replace('_', ' ')}"`, type: 'success' });
      refreshJob();
    } catch (err) {
      const msg = err.response?.data?.message ?? err.response?.data?.error ?? 'Could not update status. Try again.';
      setError(msg);
      setToast({ message: msg, type: 'error' });
    } finally {
      setUpdating(false);
    }
  }, [id, refreshJob]);

  // ---- Determine available action for the current status ----
  const transition  = job ? TRANSITIONS[job.status] : null;
  const canComplete = job?.status === 'in_progress';
  const canCancel   = job && !['completed', 'cancelled'].includes(job.status);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <BackButton onBack={() => navigate('/dashboard')} />
        </header>
        <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{ height: n === 1 ? 56 : 80, borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)' }}
            />
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  // ---- Error — no job data ----
  if (error && !job) {
    return (
      <div className="page">
        <header className="page-header">
          <BackButton onBack={() => navigate('/dashboard')} />
        </header>
        <main className="page-content" style={{ textAlign: 'center', paddingTop: 48 }}>
          <p style={{ color: 'var(--status-cancelled)', fontWeight: 600 }}>{error}</p>
          <button
            className="btn-secondary"
            style={{ marginTop: 20, maxWidth: 200 }}
            onClick={() => navigate('/dashboard')}
          >
            Back to Jobs
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const customerName   = job.customer_name   ?? job.customerName   ?? 'Unknown Customer';
  const customerPhone  = job.customer_phone  ?? job.customerPhone  ?? '';
  const pickupAddress  = job.pickup_address  ?? job.pickupAddress  ?? '';
  const dropoffAddress = job.dropoff_address ?? job.dropoffAddress ?? '';
  const scheduledAt    = job.scheduled_date  ?? job.scheduled_at ?? job.scheduledAt;
  const crewNotes      = job.crew_notes      ?? job.crewNotes      ?? job.notes ?? '';
  const itemSummary    = job.item_summary    ?? job.itemSummary    ?? '';
  const estimatedValue = job.estimated_value ?? job.estimatedValue;
  const jobRef         = job.reference       ?? job.ref            ?? `#${job.id}`;

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onBack={() => navigate('/dashboard')} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>Job Detail</h1>
              <StatusBadge status={job.status} size="md" />
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{jobRef}</p>
          </div>
        </div>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Inline error banner */}
        {error && (
          <div style={styles.errorBanner}>{error}</div>
        )}

        {/* Location permission notice — non-blocking, only for active jobs */}
        {permissionStatus === 'denied' && !['completed', 'cancelled'].includes(job.status) && (
          <div style={styles.locationNoticeBanner}>
            Location sharing is off — enable in browser settings for better job tracking
          </div>
        )}

        {/* ---- Action area — top of page so crew don't have to scroll ---- */}

        {/* Terminal states */}
        {job.status === 'completed' && (
          <div style={styles.completedBadge}>Job completed</div>
        )}

        {job.status === 'cancelled' && (
          <div style={styles.cancelledBadge}>This job has been cancelled</div>
        )}

        {/* Active states — forward action only at the top */}
        {transition && (
          <button
            className="btn-primary"
            onClick={() => setModal(job.status === 'in_progress' ? 'complete' : `confirm:${transition.next}`)}
            disabled={updating}
            style={{ width: '100%', fontSize: 'var(--font-size-md)' }}
          >
            {updating
              ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : <>{transition.icon} {transition.label}</>}
          </button>
        )}

        {/* Customer */}
        <Section title="Customer">
          <DetailRow icon={personIcon} value={customerName} large />
          {customerPhone && (
            <DetailRow
              icon={phoneIcon}
              value={
                <a href={`tel:${customerPhone}`} style={{ color: 'var(--color-primary)' }}>
                  {formatPhone(customerPhone)}
                </a>
              }
            />
          )}
        </Section>

        {/* Schedule */}
        <Section title="Scheduled">
          <DetailRow icon={calendarIcon} value={formatDateTime(scheduledAt) || 'TBC'} />
          {estimatedValue != null && (
            <DetailRow icon={dollarIcon} value={formatCurrency(estimatedValue)} />
          )}
        </Section>

        {/* Locations */}
        <Section title="Locations">
          <div style={styles.locationRow}>
            <div style={{ ...styles.dot, backgroundColor: 'var(--status-enroute)' }} />
            <div>
              <p style={styles.locationLabel}>Pickup</p>
              <p style={styles.locationValue}>{shortAddress(pickupAddress) || 'TBC'}</p>
            </div>
          </div>
          {dropoffAddress && (
            <>
              <div style={styles.locationLine} />
              <div style={styles.locationRow}>
                <div style={{ ...styles.dot, backgroundColor: 'var(--status-completed)' }} />
                <div>
                  <p style={styles.locationLabel}>Drop-off</p>
                  <p style={styles.locationValue}>{shortAddress(dropoffAddress)}</p>
                </div>
              </div>
            </>
          )}
          {pickupAddress && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <a
                href={buildPickupUrl(pickupAddress)}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.navigateBtn}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                To Pickup
              </a>
              {dropoffAddress && (
                <a
                  href={buildDropoffUrl(pickupAddress, dropoffAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.navigateBtnSecondary}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  To Drop-off
                </a>
              )}
            </div>
          )}
        </Section>

        {/* Items */}
        {itemSummary && (
          <Section title="Items">
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', lineHeight: 1.6 }}>
              {itemSummary}
            </p>
          </Section>
        )}

        {/* Crew notes */}
        {crewNotes && (
          <Section title="Crew Notes">
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {crewNotes}
            </p>
          </Section>
        )}

        {/* Cancellation reason (if cancelled) */}
        {job.status === 'cancelled' && job.cancellation_reason && (
          <Section title="Cancellation Reason">
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {job.cancellation_reason}
            </p>
          </Section>
        )}

        {/* Time Tracker — visible when job is arrived, in_progress, or completed */}
        {['arrived', 'in_progress', 'completed'].includes(job.status) && (
          <TimeTracker jobId={job.id} jobStatus={job.status} />
        )}

        {/* Photo Capture — visible for all statuses except cancelled */}
        {job.status !== 'cancelled' && (
          <PhotoCapture jobId={job.id} />
        )}

        {/* Create Invoice button — available on all non-cancelled jobs with a linked contact */}
        {job.status !== 'cancelled' && job.ghl_contact_id && (
          <button
            type="button"
            onClick={() => navigate(`/jobs/${id}/create-invoice`)}
            style={styles.createInvoiceBtn}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            Create Invoice
          </button>
        )}

        {/* Invoices — loads independently, non-blocking */}
        {(invoicesLoading || invoices.length > 0) && (
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 16px 8px', borderBottom: '1px solid var(--color-border)' }}>
              Invoices
            </p>
            <div style={{ padding: '8px 0' }}>
              {invoicesLoading ? (
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Loading invoices…</span>
                </div>
              ) : invoices.map((inv) => {
                const isExpanded = expandedInvoice === inv.id;
                const statusStyle = INV_STATUS_STYLES[inv.status] ?? INV_STATUS_STYLES.default;
                return (
                  <div key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {/* Invoice row — tap to expand */}
                    <button
                      type="button"
                      onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                      style={styles.invoiceRow}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                            {inv.invoiceNumber ? `#${inv.invoiceNumber}` : 'Invoice'}
                          </span>
                          {inv.title && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {inv.title}
                            </span>
                          )}
                        </div>
                        {inv.issueDate && (
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)', marginTop: 2 }}>
                            {formatDate(inv.issueDate)}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{ ...styles.invStatusBadge, ...statusStyle }}>
                          {INV_STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                          {formatCurrency(inv.total)}
                        </span>
                      </div>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="var(--color-text-dim)" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0, marginLeft: 8, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {/* Expanded: line items + amount due */}
                    {isExpanded && (
                      <div style={styles.invoiceDetail}>
                        {inv.lineItems.length > 0 && (
                          <>
                            <p style={styles.invoiceDetailLabel}>Items</p>
                            {inv.lineItems.map((li, i) => (
                              <div key={i} style={styles.lineItem}>
                                <span style={{ flex: 1, fontSize: 'var(--font-size-xs)', color: 'var(--color-text)' }}>
                                  {li.name}{li.qty !== 1 ? ` × ${li.qty}` : ''}
                                </span>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)', flexShrink: 0 }}>
                                  {formatCurrency(li.total || li.unitPrice * li.qty)}
                                </span>
                              </div>
                            ))}
                            <div style={styles.invoiceDivider} />
                          </>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {inv.status === 'paid' ? 'Paid' : 'Amount Due'}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: inv.status === 'paid' ? 'var(--status-completed)' : 'var(--color-text)' }}>
                            {formatCurrency(inv.status === 'paid' ? inv.total : inv.amountDue)}
                          </span>
                        </div>
                        {inv.dueDate && inv.status !== 'paid' && (
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)', marginTop: 6 }}>
                            Due {formatDate(inv.dueDate)}
                          </p>
                        )}
                        {/* Send + Delete — only for draft invoices */}
                        {inv.status === 'draft' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={sendingInvoice === inv.id || deletingInvoice === inv.id}
                              onClick={() => handleSendInvoice(inv.id)}
                              style={{ width: '100%', fontSize: 'var(--font-size-sm)', padding: '10px 0' }}
                            >
                              {sendingInvoice === inv.id
                                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Sending…</span>
                                : 'Send Invoice to Client'}
                            </button>
                            <button
                              type="button"
                              disabled={deletingInvoice === inv.id || sendingInvoice === inv.id}
                              onClick={() => setConfirmDeleteId(inv.id)}
                              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer', padding: '4px 0', textAlign: 'center', opacity: (deletingInvoice === inv.id || sendingInvoice === inv.id) ? 0.5 : 1 }}
                            >
                              {deletingInvoice === inv.id ? 'Deleting…' : 'Delete Draft'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancel — at the bottom, away from the primary action to prevent fat-finger mistakes */}
        {canCancel && (
          <button
            className="btn-danger"
            style={{ width: '100%' }}
            onClick={() => setModal('cancel')}
            disabled={updating}
          >
            Cancel Job
          </button>
        )}

      </main>

      <BottomNav />

      {/* ---- Modals ---- */}

      {/* Simple confirm modal for forward transitions (enroute / arrived / in_progress) */}
      {modal && modal.startsWith('confirm:') && (() => {
        const nextStatus  = modal.replace('confirm:', '');
        const transConfig = transition;
        return (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <p style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)', marginBottom: 8 }}>
                Confirm: {transConfig?.label}?
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: nextStatus === 'in_progress' ? 12 : 16 }}>
                This will update the job status to <strong>{nextStatus.replace('_', ' ')}</strong>.
                {nextStatus === 'in_progress' && ' Time tracking will start automatically.'}
              </p>
              {nextStatus === 'in_progress' && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  marginBottom: 16,
                }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--status-completed)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Clock-in time
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--status-completed)', letterSpacing: '0.04em' }}>
                    {liveTime}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setModal(null)}
                  disabled={updating}
                >
                  Back
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handleStatusUpdate(nextStatus)}
                  disabled={updating}
                >
                  {updating
                    ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Invoice confirm modal */}
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete Invoice"
          description="This draft invoice will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          updating={deletingInvoice === confirmDeleteId}
          onConfirm={handleDeleteInvoice}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* Complete Job modal — optional notes */}
      {modal === 'complete' && (
        <ActionModal
          title="Complete Job"
          placeholder="Add completion notes (optional)..."
          confirmLabel="Complete Job"
          confirmStyle="primary"
          updating={updating}
          requireInput={false}
          onCancel={() => setModal(null)}
          onConfirm={(notes) => handleStatusUpdate('completed', notes || undefined)}
        />
      )}

      {/* Cancel Job modal — reason required */}
      {modal === 'cancel' && (
        <ActionModal
          title="Cancel Job"
          placeholder="Reason for cancellation (required)..."
          confirmLabel="Confirm Cancellation"
          confirmStyle="danger"
          updating={updating}
          requireInput={true}
          onCancel={() => setModal(null)}
          onConfirm={(reason) => handleStatusUpdate('cancelled', undefined, reason)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function BackButton({ onBack }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to jobs"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-muted)',
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 16px 8px', borderBottom: '1px solid var(--color-border)' }}>
        {title}
      </p>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ icon, value, large }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ color: 'var(--color-text-muted)', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: large ? 'var(--font-size-md)' : 'var(--font-size-sm)', fontWeight: large ? 600 : 400, color: 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}

/* ---- Icons (inline SVG) ---- */

const personIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const phoneIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.28h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.08-1.08a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const calendarIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const dollarIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

/* ---- Styles ---- */

const styles = {
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--status-cancelled)',
    fontSize: 'var(--font-size-sm)',
    padding: '10px 14px',
  },
  locationNoticeBanner: {
    backgroundColor: 'rgba(234,179,8,0.1)',
    border: '1px solid rgba(234,179,8,0.35)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-muted)',
    fontSize: 'var(--font-size-xs)',
    padding: '8px 14px',
    lineHeight: 1.4,
  },
  locationRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 4,
    flexShrink: 0,
  },
  locationLine: {
    width: 2,
    height: 16,
    backgroundColor: 'var(--color-border)',
    marginLeft: 4,
  },
  locationLabel: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  locationValue: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text)',
    marginTop: 2,
    lineHeight: 1.4,
  },
  navigateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  navigateBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    backgroundColor: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  completedBadge: {
    textAlign: 'center',
    backgroundColor: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--status-completed)',
    fontWeight: 600,
    fontSize: 'var(--font-size-sm)',
    padding: '12px',
  },
  createInvoiceBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '11px 16px',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-primary)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  invoiceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
  },
  invStatusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  invoiceDetail: {
    padding: '0 16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  invoiceDetailLabel: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 2,
  },
  lineItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    margin: '4px 0',
  },
  cancelledBadge: {
    textAlign: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--status-cancelled)',
    fontWeight: 600,
    fontSize: 'var(--font-size-sm)',
    padding: '12px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 900,
    display: 'flex',
    alignItems: 'flex-end',
    padding: '0 0 env(safe-area-inset-bottom, 0)',
  },
  modalCard: {
    width: '100%',
    backgroundColor: 'var(--color-bg)',
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
    padding: '24px 20px',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-sm)',
    padding: '10px 12px',
    resize: 'vertical',
    minHeight: 96,
    outline: 'none',
    lineHeight: 1.5,
  },
};
