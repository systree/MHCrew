'use strict';

const axios  = require('axios');
const logger = require('../utils/logger');

const PIT_ENDPOINT = 'https://n8n.app.systree.com.au/webhook/get-pit-token';

// PITs are long-lived — cache indefinitely, only evict on explicit invalidation
const cache = new Map();

/**
 * getPitToken(locationId)
 *
 * Returns the Private Integration Token for the given GHL sub-account.
 * Fetches from the n8n PIT endpoint and caches in-memory until invalidated.
 *
 * @param {string} locationId — GHL sub-account location ID
 * @returns {Promise<string>} pit token string
 */
async function getPitToken(locationId) {
  if (!locationId) throw new Error('getPitToken: locationId is required');

  const cached = cache.get(locationId);
  if (cached) return cached;

  const pitName = process.env.GHL_PIT_NAME;
  if (!pitName) throw new Error('GHL_PIT_NAME env var is not set');

  logger.info(`pitTokenService: fetching PIT for location=${locationId} pit_name=${pitName}`);

  const response = await axios.get(PIT_ENDPOINT, {
    params:  { location_id: locationId, pit_name: pitName },
    timeout: 10_000,
  });

  const pit = response.data?.pit;
  if (!pit) {
    throw new Error(`pitTokenService: response missing pit field for location=${locationId}`);
  }

  cache.set(locationId, pit);
  logger.info(`pitTokenService: PIT cached for location=${locationId}`);

  return pit;
}

/**
 * invalidatePitToken(locationId)
 * Call this if a GHL API call using the PIT still returns 401/403.
 */
function invalidatePitToken(locationId) {
  cache.delete(locationId);
  logger.info(`pitTokenService: cache invalidated for location=${locationId}`);
}

module.exports = { getPitToken, invalidatePitToken };
