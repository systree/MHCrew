const crypto  = require('crypto');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { z }    = require('zod');
const supabase = require('../services/supabase');
const { sendSms } = require('../services/mobilemessage');
const logger              = require('../utils/logger');
const { logActivity }     = require('../utils/logger');

const SALT_ROUNDS  = 12;
const JWT_EXPIRES_IN = '30d';
const OTP_TTL_MINUTES = 10;

/* ---- Validation schemas ---- */

const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g. +61412345678)');
const otpSchema   = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');
const pinSchema   = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits');

/* ---- Internal helpers ---- */

/**
 * Sign a 30-day JWT for a crew_users row.
 */
function signSessionToken(crewUser) {
  return jwt.sign(
    {
      userId:     crewUser.id,
      phone:      crewUser.phone,
      role:       crewUser.role ?? 'crew',
      locationId: crewUser.location_id ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Return the public-safe subset of a crew_users row.
 */
function publicUser(crewUser) {
  const { pin_hash, ...safe } = crewUser; // eslint-disable-line no-unused-vars
  return safe;
}

/**
 * Fetch the IANA timezone for a location from mh_pwa_tenants.
 * Returns 'Australia/Sydney' if the tenant row doesn't exist yet.
 */
async function getTenantTimezone(locationId) {
  if (!locationId) return 'Australia/Sydney';
  const { data } = await supabase
    .from('mh_pwa_tenants')
    .select('timezone')
    .eq('location_id', locationId)
    .maybeSingle();
  return data?.timezone ?? 'Australia/Sydney';
}

/**
 * Fetch a crew_users row by phone.
 * Returns null if not found — callers must handle this case.
 * Users are provisioned via GHL UserCreate webhook; we never auto-create here
 * because we wouldn't know which location_id (tenant) to assign them to.
 */
async function getCrewUserByPhone(phone) {
  const { data, error } = await supabase
    .from('mh_pwa_crew_users')
    .select('*')
    .eq('phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data; // null if not found
}

/**
 * Generate a cryptographically random 6-digit OTP string.
 */
function generateOtp() {
  // randomInt(0, 1_000_000) gives 0–999999; pad to always be 6 digits
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * SHA-256 hex hash of a raw OTP string.
 * Fast enough for short-lived tokens; no salt needed (OTP space + expiry = sufficient entropy).
 */
function hashOtp(rawOtp) {
  return crypto.createHash('sha256').update(rawOtp).digest('hex');
}

/* ================================================================== */
/*  Controller actions                                                  */
/* ================================================================== */

/**
 * POST /auth/send-otp
 * Body: { phone }
 *
 * Generates a 6-digit OTP, stores its hash in mh_pwa_otp_tokens,
 * and sends the raw OTP to the user via MobileMessage SMS.
 */
async function sendOtp(req, res) {
  const result = phoneSchema.safeParse(req.body.phone);
  if (!result.success) {
    return res.status(422).json({
      error: 'Validation failed',
      errors: result.error.errors.map((e) => ({ field: 'phone', message: e.message })),
    });
  }

  const phone = result.data;

  try {
    const bypassPhones = (process.env.OTP_BYPASS_PHONES || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const rawOtp   = bypassPhones.includes(phone) ? '123456' : generateOtp();
    const otpHash  = hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // Invalidate any previous unused tokens for this phone to prevent reuse
    await supabase
      .from('mh_pwa_otp_tokens')
      .update({ used: true })
      .eq('phone', phone)
      .eq('used', false);

    // Store the new token
    const { error: insertError } = await supabase
      .from('mh_pwa_otp_tokens')
      .insert({ phone, otp_hash: otpHash, expires_at: expiresAt });

    if (insertError) {
      logger.error(`sendOtp DB insert error for ${phone}:`, insertError);
      return res.status(500).json({ error: 'Failed to generate OTP. Please try again.' });
    }

    if (bypassPhones.includes(phone)) {
      logger.warn(`[OTP BYPASS] OTP for ${phone}: ${rawOtp}  <-- dev bypass, no SMS sent`);
    } else {
      await sendSms(phone, `Your Mover Hero verification code is: ${rawOtp}. Valid for ${OTP_TTL_MINUTES} minutes.`);
    }

    logger.info(`OTP sent to ${phone}${bypassPhones.includes(phone) ? ' (bypass — check console)' : ''}`);
    logActivity('auth', 'otp_sent', { phone, bypass: bypassPhones.includes(phone) });
    return res.json({ message: 'OTP sent' });
  } catch (err) {
    logger.error('sendOtp unexpected error', err);
    logActivity('auth', 'otp_send_error', { phone, error: err.message }, 'error');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /auth/verify-otp
 * Body: { phone, token }
 *
 * Looks up the most recent unexpired, unused OTP token for the phone,
 * compares hashes, marks it used, then returns a session JWT.
 */
async function verifyOtp(req, res) {
  const phoneResult = phoneSchema.safeParse(req.body.phone);
  const tokenResult = otpSchema.safeParse(req.body.token);

  const validationErrors = [];
  if (!phoneResult.success) {
    validationErrors.push(...phoneResult.error.errors.map((e) => ({ field: 'phone', message: e.message })));
  }
  if (!tokenResult.success) {
    validationErrors.push(...tokenResult.error.errors.map((e) => ({ field: 'token', message: e.message })));
  }
  if (validationErrors.length) {
    return res.status(422).json({ error: 'Validation failed', errors: validationErrors });
  }

  const phone    = phoneResult.data;
  const rawToken = tokenResult.data;

  try {
    const now = new Date().toISOString();

    // Fetch the most recent valid token for this phone
    const { data: tokenRow, error: fetchError } = await supabase
      .from('mh_pwa_otp_tokens')
      .select('id, otp_hash, expires_at')
      .eq('phone', phone)
      .eq('used', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logger.error(`verifyOtp DB fetch error for ${phone}:`, fetchError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!tokenRow) {
      logger.warn(`verifyOtp: no valid token found for ${phone}`);
      logActivity('auth', 'otp_verify_failed', { phone, reason: 'no_valid_token' }, 'warn');
      return res.status(401).json({ error: 'Invalid or expired code. Please try again.' });
    }

    // Constant-time hash comparison
    const submittedHash = hashOtp(rawToken);
    const storedHash    = Buffer.from(tokenRow.otp_hash, 'hex');
    const submittedBuf  = Buffer.from(submittedHash, 'hex');

    if (storedHash.length !== submittedBuf.length || !crypto.timingSafeEqual(storedHash, submittedBuf)) {
      logger.warn(`verifyOtp: incorrect OTP for ${phone}`);
      logActivity('auth', 'otp_verify_failed', { phone, reason: 'wrong_code' }, 'warn');
      return res.status(401).json({ error: 'Invalid or expired code. Please try again.' });
    }

    // Mark token as used
    await supabase
      .from('mh_pwa_otp_tokens')
      .update({ used: true })
      .eq('id', tokenRow.id);

    // Fetch the crew_users record — must already exist (provisioned via GHL)
    const crewUser = await getCrewUserByPhone(phone);

    if (!crewUser) {
      logger.warn(`verifyOtp: no active crew account found for ${phone}`);
      logActivity('auth', 'otp_verify_failed', { phone, reason: 'no_crew_account' }, 'warn');
      return res.status(403).json({
        error: 'Your account has not been set up yet. Please contact your manager.',
      });
    }

    const sessionToken   = signSessionToken(crewUser);
    const requiresPinSetup = !crewUser.pin_hash;
    const timezone = await getTenantTimezone(crewUser.location_id);

    logger.info(`OTP verified for ${phone} location=${crewUser.location_id} — requiresPinSetup=${requiresPinSetup}`);
    logActivity('auth', 'otp_verify_success', { userId: crewUser.id, locationId: crewUser.location_id, phone, requiresPinSetup });

    return res.json({
      requiresPinSetup,
      sessionToken,
      timezone,
      user: publicUser(crewUser),
    });
  } catch (err) {
    logger.error('verifyOtp unexpected error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /auth/setup-pin
 * Protected — requires auth middleware
 * Body: { pin }
 */
async function setupPin(req, res) {
  const result = pinSchema.safeParse(req.body.pin);
  if (!result.success) {
    return res.status(422).json({
      error: 'Validation failed',
      errors: result.error.errors.map((e) => ({ field: 'pin', message: e.message })),
    });
  }

  const pin = result.data;
  const { userId } = req.user;

  try {
    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

    const { error } = await supabase
      .from('mh_pwa_crew_users')
      .update({ pin_hash: pinHash })
      .eq('id', userId);

    if (error) {
      logger.error(`setupPin DB error for userId=${userId}: ${error.message}`);
      return res.status(500).json({ error: 'Failed to save PIN. Please try again.' });
    }

    logger.info(`PIN set for userId=${userId}`);
    logActivity('auth', 'pin_setup', { userId });
    return res.json({ message: 'PIN set successfully' });
  } catch (err) {
    logger.error('setupPin unexpected error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /auth/login-pin
 * Body: { phone, pin }
 */
async function loginWithPin(req, res) {
  const phoneResult = phoneSchema.safeParse(req.body.phone);
  const pinResult   = pinSchema.safeParse(req.body.pin);

  const validationErrors = [];
  if (!phoneResult.success) {
    validationErrors.push(...phoneResult.error.errors.map((e) => ({ field: 'phone', message: e.message })));
  }
  if (!pinResult.success) {
    validationErrors.push(...pinResult.error.errors.map((e) => ({ field: 'pin', message: e.message })));
  }
  if (validationErrors.length) {
    return res.status(422).json({ error: 'Validation failed', errors: validationErrors });
  }

  const { phone, pin } = { phone: phoneResult.data, pin: pinResult.data };

  try {
    const { data: crewUser, error: fetchError } = await supabase
      .from('mh_pwa_crew_users')
      .select('*')
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) {
      logger.error(`loginWithPin DB error for ${phone}: ${fetchError.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!crewUser) {
      return res.status(401).json({ error: 'Account not found or access has been revoked. Please contact your manager.' });
    }

    if (!crewUser.pin_hash) {
      return res.status(401).json({ error: 'PIN not set up. Please sign in with OTP first.' });
    }

    const match = await bcrypt.compare(pin, crewUser.pin_hash);
    if (!match) {
      logger.warn(`loginWithPin: incorrect PIN for ${phone}`);
      logActivity('auth', 'login_pin_failed', { phone, locationId: crewUser.location_id, reason: 'wrong_pin' }, 'warn');
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    const sessionToken = signSessionToken(crewUser);
    const timezone = await getTenantTimezone(crewUser.location_id);
    logger.info(`PIN login successful for ${phone}`);
    logActivity('auth', 'login_success', { userId: crewUser.id, locationId: crewUser.location_id, phone, method: 'pin' });

    return res.json({
      sessionToken,
      timezone,
      user: publicUser(crewUser),
    });
  } catch (err) {
    logger.error('loginWithPin unexpected error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /auth/me
 * Protected — requires auth middleware
 */
async function getMe(req, res) {
  const { userId } = req.user;

  try {
    const { data: crewUser, error } = await supabase
      .from('mh_pwa_crew_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      logger.error(`getMe DB error for userId=${userId}: ${error.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!crewUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const timezone = await getTenantTimezone(crewUser.location_id);
    return res.json({ user: publicUser(crewUser), timezone });
  } catch (err) {
    logger.error('getMe unexpected error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { sendOtp, verifyOtp, setupPin, loginWithPin, getMe };
