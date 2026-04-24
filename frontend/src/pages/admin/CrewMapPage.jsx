import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCrewLocations } from '../../services/adminApi.js';
import BottomNav from '../../components/BottomNav.jsx';

const REFRESH_INTERVAL_MS = 60_000;

const STATUS_COLORS = {
  enroute:     '#60a5fa',
  arrived:     '#facc15',
  in_progress: '#4ade80',
};

const STATUS_LABELS = {
  enroute:     'En Route',
  arrived:     'Arrived',
  in_progress: 'In Progress',
};

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)       return `${diff}s ago`;
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function createMarkerIcon(name, status) {
  const color = STATUS_COLORS[status] ?? '#e94560';
  const label = initials(name);
  return L.divIcon({
    html: `<div style="
      width:38px;height:38px;border-radius:50%;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      color:#111;font-weight:800;font-size:13px;
      border:2.5px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.45);
      font-family:sans-serif;
    ">${label}</div>`,
    className: '',
    iconSize:    [38, 38],
    iconAnchor:  [19, 19],
    popupAnchor: [0, -22],
  });
}

// ---------------------------------------------------------------------------
// CrewMapPage
// Shows last known location per driver per active job.
// Locations are captured on job status changes (En Route, Arrived, In Progress).
// ---------------------------------------------------------------------------
export default function CrewMapPage() {
  const navigate   = useNavigate();
  const mapRef     = useRef(null);    // Leaflet Map instance
  const mapElRef   = useRef(null);    // DOM div ref
  const markersRef = useRef([]);      // Leaflet Marker instances

  const [drivers,     setDrivers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown,   setCountdown]   = useState(REFRESH_INTERVAL_MS / 1000);

  // ---------------------------------------------------------------------------
  // Fetch drivers from backend
  // ---------------------------------------------------------------------------
  const fetchDrivers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { drivers: data } = await getCrewLocations();
      setDrivers(data ?? []);
      setLastUpdated(new Date());
      setCountdown(REFRESH_INTERVAL_MS / 1000);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to load driver locations.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  // Auto-refresh countdown
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          fetchDrivers(true);
          return REFRESH_INTERVAL_MS / 1000;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated, fetchDrivers]);

  // ---------------------------------------------------------------------------
  // Initialise Leaflet map once
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      center:    [-33.8688, 151.2093], // default: Sydney
      zoom:      11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Sync markers whenever drivers data changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!drivers.length) return;

    const bounds = [];

    drivers.forEach((d) => {
      const latlng = [d.lat, d.lng];
      bounds.push(latlng);

      const marker = L.marker(latlng, {
        icon: createMarkerIcon(d.crewName, d.jobStatus),
      });

      const statusColor  = STATUS_COLORS[d.jobStatus] ?? '#e94560';
      const statusLabel  = STATUS_LABELS[d.jobStatus] ?? d.jobStatus;
      const ago          = d.timestamp ? timeAgo(d.timestamp) : '—';
      const accuracy     = d.accuracy  ? `±${Math.round(d.accuracy)}m` : '';

      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:180px;padding:2px 0">
          <div style="font-weight:800;font-size:14px;color:#111;margin-bottom:4px">${d.crewName}</div>
          <div style="font-size:12px;color:#555;margin-bottom:6px">${d.customerName || 'No customer'}</div>
          <span style="
            display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;
            background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44;
            margin-bottom:8px;
          ">${statusLabel}</span>
          <div style="font-size:11px;color:#777">Last seen: ${ago} ${accuracy}</div>
          ${d.pickupAddress ? `<div style="font-size:11px;color:#777;margin-top:2px">Pickup: ${d.pickupAddress}</div>` : ''}
        </div>
      `, { maxWidth: 240 });

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [drivers]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const activeCount = drivers.length;

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            style={styles.backBtn}
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={styles.title}>Driver Locations</h1>
            <p style={styles.subtitle}>
              Last known position at each job status update
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchDrivers(false)}
            style={styles.refreshBtn}
            disabled={loading}
            aria-label="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: loading ? 'rotate(360deg)' : 'none', transition: loading ? 'transform 0.6s linear' : 'none' }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </header>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <div style={styles.driverBadge}>
          <span style={{ ...styles.dot, backgroundColor: activeCount > 0 ? '#4ade80' : 'var(--color-text-dim)' }} />
          <span>{activeCount} active driver{activeCount !== 1 ? 's' : ''}</span>
        </div>
        {lastUpdated && !loading && (
          <span style={styles.countdown}>Refresh in {countdown}s</span>
        )}
        {loading && (
          <span style={styles.countdown}>Updating…</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>{error}</div>
      )}

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Leaflet map container — always mounted so the map initialises */}
        <div
          ref={mapElRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: 400,
            display: (!loading && !error && activeCount === 0) ? 'none' : 'block',
          }}
        />

        {/* Empty state — shown over the (hidden) map when no drivers */}
        {!loading && !error && activeCount === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <p style={styles.emptyTitle}>No active drivers</p>
            <p style={styles.emptyBody}>
              Locations appear here when a driver marks a job En Route, Arrived, or In Progress.
            </p>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div style={styles.loadingOverlay}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          </div>
        )}
      </div>

      {/* Legend */}
      {activeCount > 0 && (
        <div style={styles.legend}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: STATUS_COLORS[key] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

/* ---- Styles ---- */

const styles = {
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  subtitle: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 1,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: 'var(--color-surface-2)',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  driverBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  countdown: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-dim)',
  },
  errorBanner: {
    margin: '8px 16px 0',
    padding: '8px 12px',
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#f87171',
    fontSize: 'var(--font-size-sm)',
    flexShrink: 0,
  },
  emptyState: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: 'var(--color-background)',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  emptyBody: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 1.5,
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-background)',
  },
  legend: {
    display: 'flex',
    gap: 16,
    padding: '8px 16px',
    backgroundColor: 'var(--color-surface-2)',
    borderTop: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
};
