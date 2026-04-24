'use strict';

const path = require('path');
const { createLogger, format, transports } = require('winston');
const supabase = require('../services/supabase');

const { combine, timestamp, colorize, printf, errors } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) =>
    stack ? `${ts} [${level}]: ${message}\n${stack}` : `${ts} [${level}]: ${message}`
  )
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format.json()
);

const isDev = process.env.NODE_ENV !== 'production';

const loggerTransports = [new transports.Console()];

if (!isDev) {
  const logsDir = path.join(__dirname, '../../logs');
  loggerTransports.push(
    new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error', maxsize: 10_000_000, maxFiles: 5 }),
    new transports.File({ filename: path.join(logsDir, 'app.log'),   maxsize: 10_000_000, maxFiles: 10 })
  );
}

const logger = createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev ? devFormat : prodFormat,
  transports: loggerTransports,
});

// ---------------------------------------------------------------------------
// logActivity — fire-and-forget DB activity log
// Never awaited — must never block request handling.
//
// Usage:
//   logActivity('auth',    'login_success', { userId, locationId, phone });
//   logActivity('job',     'status_update', { userId, locationId, jobId, from, to });
//   logActivity('webhook', 'received',      { locationId, eventType });
//   logActivity('system',  'error',         { locationId, message }, 'error');
// ---------------------------------------------------------------------------
function logActivity(category, action, meta = {}, level = 'info') {
  const { userId, locationId, ...rest } = meta;

  // Fire and forget — intentionally no await
  supabase
    .from('mh_pwa_activity_log')
    .insert({
      location_id: locationId ?? null,
      user_id:     userId     ?? null,
      category,
      action,
      level,
      meta: Object.keys(rest).length ? rest : null,
    })
    .then(({ error }) => {
      if (error) logger.warn(`logActivity DB insert failed: ${error.message}`);
    });
}

module.exports = logger;
module.exports.logActivity = logActivity;
