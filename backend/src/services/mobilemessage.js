/**
 * MobileMessage SMS service
 *
 * Sends SMS via the MobileMessage REST API.
 *
 * Required env vars:
 *   MOBILEMESSAGE_USERNAME  — API username (Basic Auth)
 *   MOBILEMESSAGE_PASSWORD  — API password (Basic Auth)
 *   MOBILEMESSAGE_SENDER_ID — registered Sender ID shown to recipient (e.g. "MoverHero")
 *
 * API reference: https://mobilemessage.com.au/api-documentation
 * Endpoint used: POST https://api.mobilemessage.com.au/v1/messages
 *   - Basic Auth: base64(username:password)
 *   - Body: { messages: [{ to, message, sender }] }
 *   - 200 response: { status, send_id, total_cost, results: [{ to, status, message_id, ... }] }
 *
 * If MobileMessage updates their endpoint/format, adjust ENDPOINT and
 * buildPayload() below — nothing else in the app needs to change.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const ENDPOINT = 'https://api.mobilemessage.com.au/v1/messages';

function buildPayload(to, message) {
  return {
    messages: [
      {
        to,                                                  // local (0412…) or international (+61412…) format
        message,
        sender: process.env.MOBILEMESSAGE_SENDER_ID || 'MoverHero',
      },
    ],
  };
}

/**
 * Send an SMS message.
 * @param {string} to      - Recipient phone (local or international format)
 * @param {string} message - Message body
 * @throws {Error}         - If credentials are missing, the API call fails
 *                           (non-2xx / network error), or the message is rejected
 */
async function sendSms(to, message) {
  const username = process.env.MOBILEMESSAGE_USERNAME;
  const password = process.env.MOBILEMESSAGE_PASSWORD;
  if (!username || !password) {
    throw new Error('MOBILEMESSAGE_USERNAME / MOBILEMESSAGE_PASSWORD are not set');
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const response = await axios.post(ENDPOINT, buildPayload(to, message), {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  });

  // A 2xx can still carry a per-message failure in results[] — surface it so
  // callers (e.g. OTP send) don't silently believe an SMS went out.
  const result = response.data?.results?.[0];
  if (result && result.status !== 'success') {
    throw new Error(`MobileMessage rejected SMS to ${to}: ${result.status}${result.error ? ` — ${result.error}` : ''}`);
  }

  logger.info(`MobileMessage SMS sent to ${to} — status ${response.status}, message_id ${result?.message_id ?? 'n/a'}`);
  return response.data;
}

module.exports = { sendSms };
