import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCrew, updateCrewMember } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

/**
 * CrewManagementPage
 *
 * Displays all crew members for this location.
 * Allows toggling active state and changing role (crew / admin).
 */

const FILTERS = ['All', 'Active', 'Inactive'];

export default function CrewManagementPage() {
  const navigate = useNavigate();

  const [crew,       setCrew]       = useState([]);
  const [filter,     setFilter]     = useState('All');
  const [loadState,  setLoadState]  = useState({ loading: true, error: null });
  const [updating,   setUpdating]   = useState({});  // { [memberId]: true }
  const [feedback,   setFeedback]   = useState({});  // { [memberId]: { type: 'success'|'error', msg } }

  /* ---- Load crew on mount ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCrew();
        if (cancelled) return;
        setCrew(data.crew ?? []);
        setLoadState({ loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setLoadState({ loading: false, error: err?.response?.data?.message ?? 'Failed to load crew.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- Update helper ---- */
  const handleUpdate = async (id, updates) => {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    setFeedback((prev) => ({ ...prev, [id]: null }));
    try {
      const data = await updateCrewMember(id, updates);
      // Apply the returned member data into local state
      setCrew((prev) => prev.map((m) => (m.id === id ? { ...m, ...data.member } : m)));
      setFeedback((prev) => ({ ...prev, [id]: { type: 'success', msg: 'Updated.' } }));
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        [id]: { type: 'error', msg: err?.response?.data?.message ?? 'Update failed.' },
      }));
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  /* ---- Filtered list ---- */
  const filtered = crew.filter((m) => {
    if (filter === 'Active')   return m.is_active !== false;
    if (filter === 'Inactive') return m.is_active === false;
    return true;
  });

  /* ---- Counts for filter badges ---- */
  const counts = {
    All:      crew.length,
    Active:   crew.filter((m) => m.is_active !== false).length,
    Inactive: crew.filter((m) => m.is_active === false).length,
  };

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
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={styles.headerTitle}>Crew</h1>
            {!loadState.loading && (
              <p style={styles.headerSub}>{crew.length} member{crew.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <span style={{ width: 40 }} />
        </div>
      </header>

      {/* Content */}
      <main className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Filter tabs */}
        {!loadState.loading && crew.length > 0 && (
          <div style={styles.filterRow}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  ...styles.filterBtn,
                  ...(filter === f ? styles.filterBtnActive : {}),
                }}
              >
                {f}
                <span style={{
                  ...styles.filterCount,
                  ...(filter === f ? styles.filterCountActive : {}),
                }}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        )}

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

        {/* Empty state */}
        {!loadState.loading && !loadState.error && crew.length === 0 && (
          <div style={styles.emptyState}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 12 }}>
              No crew members
            </p>
          </div>
        )}

        {/* Filtered empty */}
        {!loadState.loading && crew.length > 0 && filtered.length === 0 && (
          <div style={styles.emptyState}>
            <p style={{ color: 'var(--color-text-muted)' }}>No {filter.toLowerCase()} members.</p>
          </div>
        )}

        {/* Crew cards */}
        {filtered.map((member) => {
          const isActive    = member.is_active !== false;
          const isUpdating  = !!updating[member.id];
          const fb          = feedback[member.id];
          const displayName = member.full_name || member.phone || member.ghl_user_id || `User ${member.id.slice(0, 8)}`;

          return (
            <div key={member.id} className="card" style={styles.memberCard}>
              {/* Top row: avatar + info + status badge */}
              <div style={styles.memberTop}>
                {/* Avatar initials */}
                <span style={styles.avatar} aria-hidden="true">
                  {displayName.charAt(0).toUpperCase()}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={styles.memberName}>{displayName}</p>
                  {member.phone && (
                    <p style={styles.memberPhone}>{member.phone}</p>
                  )}
                  {member.ghl_user_id && (
                    <p style={styles.memberGhlId}>GHL: {member.ghl_user_id}</p>
                  )}
                  <div style={styles.badgeRow}>
                    <RoleBadge role={member.role} />
                    <StatusBadge isActive={isActive} />
                  </div>
                </div>
              </div>

              {/* Inline feedback */}
              {fb && (
                <div style={{
                  ...styles.inlineFeedback,
                  ...(fb.type === 'success' ? styles.inlineFeedbackSuccess : styles.inlineFeedbackError),
                }}>
                  {fb.msg}
                </div>
              )}

              {/* Controls */}
              <div style={styles.controls}>
                {/* Role selector */}
                <div style={{ flex: 1 }}>
                  <label style={styles.controlLabel} htmlFor={`role-${member.id}`}>Role</label>
                  <select
                    id={`role-${member.id}`}
                    value={member.role ?? 'crew'}
                    onChange={(e) => handleUpdate(member.id, { role: e.target.value })}
                    disabled={isUpdating}
                    style={styles.roleSelect}
                    aria-label={`Role for ${displayName}`}
                  >
                    <option value="crew">Crew</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Active toggle button */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <label style={styles.controlLabel}>Status</label>
                  <button
                    type="button"
                    onClick={() => handleUpdate(member.id, { isActive: !isActive })}
                    disabled={isUpdating}
                    style={{
                      ...styles.toggleBtn,
                      ...(isActive ? styles.toggleBtnActive : styles.toggleBtnInactive),
                    }}
                    aria-label={isActive ? `Deactivate ${displayName}` : `Activate ${displayName}`}
                  >
                    {isUpdating ? (
                      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    ) : isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

      </main>

      <BottomNav />
    </div>
  );
}

/* ---- Sub-components ---- */

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      backgroundColor: isAdmin ? 'rgba(233,69,96,0.15)' : 'rgba(136,136,170,0.12)',
      color: isAdmin ? 'var(--color-primary)' : 'var(--color-text-muted)',
      border: isAdmin ? '1px solid rgba(233,69,96,0.3)' : '1px solid var(--color-border)',
    }}>
      {role ?? 'crew'}
    </span>
  );
}

function StatusBadge({ isActive }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      backgroundColor: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
      color: isActive ? '#4ade80' : '#f87171',
      border: isActive ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
    }}>
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: isActive ? '#4ade80' : '#f87171',
          flexShrink: 0,
        }}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
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
  filterRow: {
    display: 'flex',
    gap: 6,
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
    height: 100,
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
  memberCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  memberTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-surface-3)',
    color: 'var(--color-text)',
    fontWeight: 800,
    fontSize: 'var(--font-size-md)',
    flexShrink: 0,
    border: '1px solid var(--color-border)',
  },
  memberName: {
    fontWeight: 700,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
  },
  memberPhone: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
  memberGhlId: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-dim)',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  badgeRow: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  inlineFeedback: {
    padding: '7px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
  },
  inlineFeedbackSuccess: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80',
  },
  inlineFeedbackError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
  },
  controls: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-end',
    borderTop: '1px solid var(--color-border)',
    paddingTop: 12,
  },
  controlLabel: {
    display: 'block',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  roleSelect: {
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundColor: 'var(--color-surface-2)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    padding: '9px 12px',
    width: '100%',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
  },
  toggleBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    border: '1.5px solid transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    transition: 'background-color var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
    color: '#f87171',
  },
  toggleBtnInactive: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.25)',
    color: '#4ade80',
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
};
