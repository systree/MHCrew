'use strict';

const axios              = require('axios');
const { getToken, invalidateToken } = require('./ghlTokenService');
const logger             = require('../utils/logger');

const GHL_BASE_URL = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';
const GHL_VERSION  = '2021-07-28';

/**
 * getGhlClient(locationId)
 *
 * Returns an axios instance configured with the OAuth access token for the
 * given GHL sub-account. The token is fetched (and cached) via ghlTokenService.
 *
 * Automatically invalidates the cached token and retries once on 401 so that
 * a token refresh triggered by n8n is picked up without manual intervention.
 *
 * @param {string} locationId — GHL sub-account location ID
 * @returns {Promise<import('axios').AxiosInstance>}
 */
async function getGhlClient(locationId) {
  const token = await getToken(locationId);

  const client = axios.create({
    baseURL: GHL_BASE_URL,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Version:        GHL_VERSION,
    },
    timeout: 15_000,
  });

  // Response interceptor: on 401 invalidate cache and retry once
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status  = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401 && !error.config._retried) {
        logger.warn(`GHL API 401 for location=${locationId} — invalidating token and retrying`);
        invalidateToken(locationId);

        const freshToken = await getToken(locationId);
        error.config._retried = true;
        error.config.headers['Authorization'] = `Bearer ${freshToken}`;
        return axios(error.config);
      }

      const enhanced = new Error(`GHL API error [${status}]: ${message}`);
      enhanced.status = status;
      enhanced.originalError = error;
      return Promise.reject(enhanced);
    }
  );

  return client;
}

module.exports = { getGhlClient };
