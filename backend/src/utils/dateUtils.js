'use strict';

/**
 * dateUtils.js
 *
 * Shared date-parsing utilities for converting GHL custom field datetime
 * strings into UTC ISO strings suitable for Supabase timestamptz columns.
 *
 * The core problem: GHL sends dates as plain text (e.g. "08/04/2026 09:30 AM")
 * representing wall-clock time in the sub-account's local timezone. If we
 * naively construct a Date object on a UTC server, the resulting UTC value is
 * wrong by the location's UTC offset (e.g. 10 hours for Australia/Sydney).
 */

/**
 * Convert a naive local datetime (wall-clock time in `timezone`) to a UTC ISO string.
 *
 * Uses the Intl offset trick — no external libraries required:
 *   1. Build a probe Date treating the components as UTC.
 *   2. Format that UTC moment in the target timezone to see what wall-clock
 *      time it represents there.
 *   3. Compute the delta between intended and actual → adjust the probe.
 *
 * @param {number} year
 * @param {number} month   1-based (January = 1)
 * @param {number} day
 * @param {number} hour    0-23
 * @param {number} minute  0-59
 * @param {string} timezone IANA timezone, e.g. 'Australia/Sydney'
 * @returns {string} UTC ISO string
 */
function naiveToUtcIso(year, month, day, hour, minute, timezone) {
  // Step 1 — probe: treat the given components as if they were UTC
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Step 2 — find what wall-clock time this UTC moment represents in `timezone`
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone:  timezone,
    year:      'numeric',
    month:     '2-digit',
    day:       '2-digit',
    hour:      '2-digit',
    minute:    '2-digit',
    hour12:    false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(probe).map((p) => [p.type, p.value]));

  // Step 3 — compute the UTC offset at this moment in the target timezone
  const localMs = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour % 24,  // Intl may return '24' for midnight; normalise to 0
    +parts.minute
  );
  const offsetMs = probe.getTime() - localMs; // negative for zones east of UTC

  return new Date(probe.getTime() + offsetMs).toISOString();
}

/**
 * Parse a GHL scheduled date string into a UTC ISO string.
 *
 * Supported formats:
 *   - DD/MM/YYYY HH:MM AM/PM  e.g. "08/04/2026 9:30 AM"
 *   - DD/MM/YYYY HH:MM        e.g. "08/04/2026 14:30"
 *   - DD/MM/YYYY              e.g. "08/04/2026"   (stored as midnight UTC in tz)
 *   - YYYY-MM-DD              e.g. "2026-04-08"
 *   - Any ISO string          e.g. "2026-04-08T09:30:00Z"  (passed through)
 *
 * @param {string|null} raw      Raw value from a GHL custom field
 * @param {string}      [timezone='UTC']  IANA timezone name for interpreting
 *                               naive AU/local datetimes. Pass the tenant's
 *                               timezone so that "09:30 AM" is stored correctly.
 * @returns {string|null} UTC ISO string, or null if unparseable
 */
function parseScheduledDate(raw, timezone = 'UTC') {
  if (!raw) return null;
  const s = String(raw).trim();

  // AU format: DD/MM/YYYY [HH:MM[ AM|PM]]
  const auMatch = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
  );
  if (auMatch) {
    const [, dd, mm, yyyy, rawH, min = '00', ampm] = auMatch;
    let hour = parseInt(rawH ?? '0', 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    }
    return naiveToUtcIso(
      parseInt(yyyy, 10),
      parseInt(mm, 10),
      parseInt(dd, 10),
      hour,
      parseInt(min, 10),
      timezone
    );
  }

  // ISO date-only YYYY-MM-DD — treat as midnight in the location timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split('-').map(Number);
    return naiveToUtcIso(y, mo, d, 0, 0, timezone);
  }

  // Fallback — already an ISO datetime string (Z suffix or offset); parse directly
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = { parseScheduledDate, naiveToUtcIso };
