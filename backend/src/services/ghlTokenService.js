'use strict';

const axios  = require('axios');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// In-memory token cache: locationId → { token, expiresAt }
// GHL OAuth tokens live for 24h; we cache for 20 minutes so the n8n
// refresh flow has plenty of headroom before we re-fetch.
// ---------------------------------------------------------------------------
const TOKEN_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const cache = new Map();

/**
 * getToken(locationId)
 *
 * Returns a valid GHL OAuth access token for the given sub-account.
 * Calls the n8n token endpoint (N8N_TOKEN_ENDPOINT) with location_id + app_id.
 * Results are cached in-memory for 20 minutes.
 *
 * @param {string} locationId — GHL sub-account location ID
 * @returns {Promise<string>} access_token
 */
async function getToken(locationId) {
  if (!locationId) throw new Error('getToken: locationId is required');

  // Return cached token if still valid
  const cached = cache.get(locationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const endpoint = process.env.N8N_TOKEN_ENDPOINT;
  const appId    = process.env.GHL_APP_ID;

  if (!endpoint) throw new Error('N8N_TOKEN_ENDPOINT env var is not set');
  if (!appId)    throw new Error('GHL_APP_ID env var is not set');

  const fullUrl = `${endpoint}?location_id=${locationId}&app_id=${appId}`;
  logger.info(`ghlTokenService: fetching token for location=${locationId} app=${appId} url=${fullUrl}`);

  const response = await axios.get(endpoint, {
    params:  { location_id: locationId, app_id: appId },
    timeout: 10_000,
  });

  const token = response.data?.access_token;
  if (!token) {
    throw new Error(`ghlTokenService: n8n response missing access_token for location=${locationId}`);
  }

  cache.set(locationId, { token, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
  logger.info(`ghlTokenService: token cached for location=${locationId} (20 min TTL)`);

  return token;
}

/**
 * invalidateToken(locationId)
 * Call this if a GHL API call returns 401 so the next request forces a re-fetch.
 */
function invalidateToken(locationId) {
  cache.delete(locationId);
  logger.info(`ghlTokenService: cache invalidated for location=${locationId}`);
}

module.exports = { getToken, invalidateToken };
