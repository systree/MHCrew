import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime, extractSuburb } from '../utils/formatters.js';

/**
 * JobCard
 *
 * A tappable card displayed in the DashboardPage job list.
 * Shows the key at-a-glance information a crew member needs:
 *   - Customer name
 *   - Date + start time
 *   - Pickup suburb
 *   - Current status
 *
 * Props:
 *   job — job object from the API
 */
export default function JobCard({ job }) {
  const navigate = useNavigate();

  const customerName = job.customer_name ?? job.customerName ?? 'Unknown Customer';
  const scheduledAt  = job.scheduled_date ?? job.scheduled_at ?? job.scheduledAt;
  const suburb       = extractSuburb(job.pickup_address ?? job.pickupAddress ?? '');
  const jobRef       = job.reference ?? job.ref ?? `#${job.id}`;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/jobs/${job.id}`)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/jobs/${job.id}`)}
      aria-label={`Job for ${customerName}, ${formatDateTime(scheduledAt)}`}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
      onPointerDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.985)';
        e.currentTarget.style.borderColor = 'var(--color-primary)';
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.borderColor = '';
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.borderColor = '';
      }}
    >
      {/* Top row: customer name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)', lineHeight: 1.2 }}>
            {customerName}
          </p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {jobRef}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'var(--color-border)' }} />

      {/* Bottom row: date/time + suburb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* Date + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            {formatDateTime(scheduledAt) || 'TBC'}
          </span>
        </div>

        {/* Suburb */}
        {suburb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {suburb}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
