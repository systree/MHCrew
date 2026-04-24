'use strict';

const express = require('express');
const { Router } = require('express');
const ghlHandler = require('../webhooks/ghlHandler');

const router = Router();

/**
 * Middleware that captures the raw request body as a Buffer on req.rawBody,
 * then parses it into req.body as a plain object for downstream handlers.
 *
 * express.raw() must run before express.json() on this route so that the
 * HMAC signature can be verified against the original bytes.
 */
const captureRawBody = [
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, _res, next) => {
    // req.body is a Buffer at this point
    req.rawBody = req.body;
    try {
      req.body =
        Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0
          ? JSON.parse(req.rawBody.toString('utf8'))
          : {};
    } catch {
      req.body = {};
    }
    next();
  },
];

/**
 * POST /api/webhooks/ghl
 * Receives inbound event notifications from GoHighLevel.
 */
router.post('/ghl', captureRawBody, ghlHandler);

module.exports = router;
