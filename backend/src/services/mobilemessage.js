/**
 * MobileMessage SMS service
 *
 * Sends SMS via the MobileMessage REST API.
 *
 * Required env vars:
 *   MOBILEMESSAGE_API_KEY   — your MobileMessage API key
 *   MOBILEMESSAGE_SENDER_ID — sender name or number shown to recipient (e.g. "MoverHero")
 *
 * API reference: https://docs.mobilemessage.com.au
 * Endpoint used: POST https://api.mobilemessage.com.au/v3/sms
 *
 * If MobileMessage updates their endpoint/format, adjust ENDPOINT and
 * buildPayload() below — nothing else in the app needs to change.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const ENDPOINT = 'https://api.mobilemessage.com.au/v3/sms';

function buildPayload(to, message) {
  return {
    recipients: [to],          // E.164 format, e.g. "+61412345678"
    message,
    from: process.env.MOBILEMESSAGE_SENDER_ID || 'MoverHero',
  };
}

/**
 * Send an SMS message.
 * @param {string} to      - Recipient phone in E.164 format
 * @param {string} message - Message body
 * @throws {Error}         - If the API call fails (non-2xx or network error)
 */
async function sendSms(to, message) {
  const apiKey = process.env.MOBILEMESSAGE_API_KEY;
  if (!apiKey) {
    throw new Error('MOBILEMESSAGE_API_KEY is not set');
  }

  const response = await axios.post(ENDPOINT, buildPayload(to, message), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  });

  logger.info(`MobileMessage SMS sent to ${to} — status ${response.status}`);
  return response.data;
}

module.exports = { sendSms };
