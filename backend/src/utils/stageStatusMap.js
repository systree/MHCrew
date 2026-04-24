'use strict';

// Canonical pipeline stage name → PWA job_status mapping.
// Single source of truth — used by ghlHandler.js and adminController.js.
const STAGE_STATUS_MAP = {
  'new':         'assigned',
  'lead':        'assigned',
  'booked':      'assigned',
  'confirmed':   'assigned',
  'en route':    'enroute',
  'on site':     'arrived',
  'in progress': 'in_progress',
  'active':      'in_progress',
  'completed':   'completed',
  'done':        'completed',
  'won':         'completed',
  'cancelled':   'cancelled',
  'lost':        'cancelled',
};

function mapStageToStatus(stageName) {
  if (!stageName) return null;
  return STAGE_STATUS_MAP[stageName.trim().toLowerCase()] ?? null;
}

module.exports = { STAGE_STATUS_MAP, mapStageToStatus };
