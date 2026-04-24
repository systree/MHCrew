import React from 'react';

/**
 * StatusBadge
 *
 * Renders a small colour-coded pill conveying a job's current status.
 *
 * Props:
 *   status  — one of: assigned | enroute | arrived | in_progress | completed | cancelled
 *   size    — 'sm' (default) | 'md'
 */

const STATUS_MAP = {
  assigned:    { label: 'Assigned',    color: 'var(--status-assigned)' },
  enroute:     { label: 'En Route',    color: 'var(--status-enroute)' },
  arrived:     { label: 'Arrived',     color: 'var(--status-arrived)' },
  in_progress: { label: 'In Progress', color: 'var(--status-in-progress)' },
  completed:   { label: 'Completed',   color: 'var(--status-completed)' },
  cancelled:   { label: 'Cancelled',   color: 'var(--status-cancelled)' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', color: 'var(--color-text-dim)' };

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: size === 'md' ? '5px 12px' : '3px 9px',
    borderRadius: 'var(--radius-full)',
    fontSize: size === 'md' ? 'var(--font-size-sm)' : 'var(--font-size-xs)',
    fontWeight: 600,
    letterSpacing: '0.01em',
    backgroundColor: `${config.color}22`, // 13% opacity background
    color: config.color,
    border: `1px solid ${config.color}55`,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const dotStyle = {
    width: size === 'md' ? 7 : 6,
    height: size === 'md' ? 7 : 6,
    borderRadius: '50%',
    backgroundColor: config.color,
    flexShrink: 0,
  };

  return (
    <span style={style}>
      <span style={dotStyle} aria-hidden="true" />
      {config.label}
    </span>
  );
}
