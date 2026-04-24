/**
 * Formatting helpers used across the app.
 * All functions are pure and dependency-free.
 *
 * Timezone: call setTimezone(tz) once after the user authenticates.
 * All date/time functions will then display in the GHL sub-account's local
 * timezone rather than the crew member's device timezone.
 */

/* ------------------------------------------------------------------ */
/*  Timezone module state                                               */
/* ------------------------------------------------------------------ */

let _tz = 'Australia/Sydney';

/**
 * Set the IANA timezone used by all date/time formatters.
 * Call this once after login with the timezone from the auth response.
 */
export function setTimezone(tz) {
  if (tz) _tz = tz;
}

/**
 * Return the YYYY-MM-DD string for a Date in the active timezone.
 * Used internally for "Today / Tomorrow" comparisons.
 */
function localDateString(date) {
  // en-CA locale returns YYYY-MM-DD — convenient for string comparison
  return new Intl.DateTimeFormat('en-CA', { timeZone: _tz }).format(date);
}

/* ------------------------------------------------------------------ */
/*  Date / Time                                                         */
/* ------------------------------------------------------------------ */

/**
 * Format an ISO date string or Date object to a human-readable date.
 * e.g. "Mon 7 Apr"
 */
export function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-AU', {
    timeZone: _tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format an ISO date string or Date object to a short time.
 * e.g. "9:30 am"
 */
export function formatTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-AU', {
    timeZone: _tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date with both date and time.
 * If the time is exactly midnight in the location timezone the time portion
 * is omitted — this handles date-only fields from GHL that have no meaningful time.
 * e.g. "Tue 8 Apr" or "Tue 8 Apr, 9:30 AM"
 */
export function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  const datePart = date.toLocaleDateString('en-AU', {
    timeZone: _tz,
    weekday: 'short',
    day:     'numeric',
    month:   'short',
  });

  const hhmm = date.toLocaleTimeString('en-AU', {
    timeZone: _tz,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  });
  if (hhmm === '00:00') return datePart;

  const timePart = date.toLocaleTimeString('en-AU', {
    timeZone: _tz,
    hour:     'numeric',
    minute:   '2-digit',
    hour12:   true,
  }).toUpperCase();

  return `${datePart}, ${timePart}`;
}

/**
 * Returns "Today", "Tomorrow", "Yesterday", or the formatted date.
 * Comparisons are made in the location's timezone, not the device timezone.
 */
export function formatRelativeDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const dateStr  = localDateString(date);
  const todayStr = localDateString(new Date(now));
  const tomorrowStr = localDateString(new Date(now + 86_400_000));
  const yesterStr   = localDateString(new Date(now - 86_400_000));

  if (dateStr === todayStr)    return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  if (dateStr === yesterStr)   return 'Yesterday';
  return formatDate(value);
}

/**
 * Format a date as "Month YYYY", e.g. "April 2026".
 * Used for "member since" displays.
 */
export function formatMonthYear(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-AU', {
    timeZone: _tz,
    month: 'long',
    year:  'numeric',
  });
}

/**
 * Return the YYYY-MM-DD date string for a value in the location timezone.
 * Used by dashboard day-grouping logic.
 */
export { localDateString };

/**
 * Format a duration in minutes to a short human string.
 * e.g. formatDuration(90) → "1h 30m"
 */
export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ------------------------------------------------------------------ */
/*  Address                                                             */
/* ------------------------------------------------------------------ */

/**
 * Extract the suburb from a full address string.
 * Assumes Australian format: "Street, Suburb STATE POSTCODE"
 * Returns the suburb portion, or the full address if parsing fails.
 */
export function extractSuburb(address) {
  if (!address) return '';
  // Try to match ", Suburb STATE" pattern
  const match = address.match(/,\s*([^,]+?)\s+(?:NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i);
  if (match) return match[1].trim();
  // Fallback: second segment after first comma
  const parts = address.split(',');
  return parts.length > 1 ? parts[1].trim() : address;
}

/**
 * Truncate a long address to a single-line summary.
 * e.g. "123 Example St, Fitzroy VIC 3065" → "123 Example St, Fitzroy"
 */
export function shortAddress(address) {
  if (!address) return '';
  const parts = address.split(',');
  // Return first two segments (street + suburb)
  return parts.slice(0, 2).join(',').trim();
}

/* ------------------------------------------------------------------ */
/*  Phone                                                               */
/* ------------------------------------------------------------------ */

/**
 * Format a phone number string for display.
 * Handles Australian mobile format: 0412 345 678
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('04')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

/* ------------------------------------------------------------------ */
/*  Currency                                                            */
/* ------------------------------------------------------------------ */

/**
 * Format a number as Australian dollars.
 * e.g. formatCurrency(1500) → "$1,500.00"
 */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Misc                                                                */
/* ------------------------------------------------------------------ */

/**
 * Return initials from a full name string.
 * e.g. "Jake Morrison" → "JM"
 */
export function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}
