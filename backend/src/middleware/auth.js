const jwt = require('jsonwebtoken');
const supabase = require('../services/supabase');
const logger = require('../utils/logger');

/**
 * Verifies a Bearer JWT in the Authorization header, then confirms the crew
 * user still exists and is active. Attaches the decoded payload to req.user.
 *
 * The is_active re-check turns the otherwise-stateless 30-day JWT into a
 * DB-validated session: deactivating a crew member (is_active = false, e.g.
 * when they leave) forces logout on their very next request, even though the
 * token itself hasn't expired. The frontend's 401 interceptor then clears it.
 *
 * Returns 401 if the token is missing, invalid, expired, or the account has
 * been revoked/deleted.
 */
async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Revocation / soft-delete check. Fail OPEN on DB errors so a transient
  // database blip doesn't log every crew member out; revocation resumes as
  // soon as the DB is reachable again.
  try {
    const { data: crewUser, error } = await supabase
      .from('mh_pwa_crew_users')
      .select('is_active')
      .eq('id', decoded.userId)
      .maybeSingle();

    if (error) {
      logger.warn(`auth: is_active check errored for userId=${decoded.userId} (allowing): ${error.message}`);
    } else if (!crewUser || crewUser.is_active === false) {
      return res.status(401).json({ error: 'Access revoked' });
    }
  } catch (err) {
    logger.warn(`auth: is_active check threw for userId=${decoded.userId} (allowing): ${err.message}`);
  }

  req.user = decoded;
  next();
}

module.exports = auth;
