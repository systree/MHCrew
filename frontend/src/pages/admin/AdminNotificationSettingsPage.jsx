import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotificationSettings, updateNotificationSettings } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

/**
 * AdminNotificationSettingsPage
 *
 * Admin panel for controlling which push notifications are sent per tenant.
 * All settings are stored on the mh_pwa_tenants row and default to true.
 */
export default function AdminNotificationSettingsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const [settings, setSettings] = useState({
    crewJobAssigned:     true,
    adminStatusChanged:  true,
    adminInvoiceCreated: true,
    adminInvoiceSent:    true,
    adminInvoiceDeleted: true,
  });

  useEffect(() => {
    getNotificationSettings()
      .then((data) => setSettings(data))
      .catch(() => setError('Failed to load notification settings.'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await updateNotificationSettings(settings);
      setSuccess(true);
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            style={backBtnStyle}
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>Notification Settings</h1>
        </div>
      </header>

      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Crew notifications */}
        <div style={sectionStyle}>
          <p style={sectionLabelStyle}>Crew Notifications</p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ToggleRow
              label="Job Assigned"
              description="Notify crew member when a job is assigned to them"
              checked={settings.crewJobAssigned}
              onChange={() => toggle('crewJobAssigned')}
            />
          </div>
        </div>

        {/* Admin notifications */}
        <div style={sectionStyle}>
          <p style={sectionLabelStyle}>Admin Notifications</p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ToggleRow
              label="Status Changed"
              description="Notify admins when crew updates a job status"
              checked={settings.adminStatusChanged}
              onChange={() => toggle('adminStatusChanged')}
            />
            <ToggleRow
              label="Invoice Created"
              description="Notify admins when crew creates an invoice"
              checked={settings.adminInvoiceCreated}
              onChange={() => toggle('adminInvoiceCreated')}
            />
            <ToggleRow
              label="Invoice Sent"
              description="Notify admins when crew sends an invoice to a client"
              checked={settings.adminInvoiceSent}
              onChange={() => toggle('adminInvoiceSent')}
            />
            <ToggleRow
              label="Invoice Deleted"
              description="Notify admins when crew deletes a draft invoice"
              checked={settings.adminInvoiceDeleted}
              onChange={() => toggle('adminInvoiceDeleted')}
            />
          </div>
        </div>

        {/* Info notice */}
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: '0 8px' }}>
          Notifications are only sent to users who have enabled them in their Profile. Crew must opt in on their device.
        </p>

        {error && (
          <div style={feedbackStyle('#f87171', 'rgba(239,68,68,0.1)', 'rgba(239,68,68,0.3)')}>{error}</div>
        )}
        {success && (
          <div style={feedbackStyle('#4ade80', 'rgba(34,197,94,0.1)', 'rgba(34,197,94,0.3)')}>Settings saved.</div>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              Saving…
            </span>
          ) : 'Save Settings'}
        </button>

      </main>

      <BottomNav />
    </div>
  );
}

/* ---- Sub-components ---- */

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{label}</p>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          background: checked ? 'var(--color-primary)' : 'var(--color-border)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background var(--transition-fast)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'left var(--transition-fast)',
          }}
        />
      </button>
    </div>
  );
}

/* ---- Styles ---- */

const backBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  cursor: 'pointer',
  flexShrink: 0,
};

const sectionStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

const sectionLabelStyle = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '10px 16px 8px',
  borderBottom: '1px solid var(--color-border)',
};

const feedbackStyle = (color, bg, border) => ({
  padding: '9px 12px',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color,
  backgroundColor: bg,
  border: `1px solid ${border}`,
});
