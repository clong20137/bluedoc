const crypto = require('crypto');
const mysql = require('mysql2/promise');

const SHIELD_SESSION_COOKIE = 'shield_session';

const shieldPool = mysql.createPool({
  host: process.env.SHIELD_DB_HOST || process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.SHIELD_DB_PORT || process.env.DB_PORT || 3306),
  user: process.env.SHIELD_DB_USER || process.env.DB_USER || 'root',
  password: process.env.SHIELD_DB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.SHIELD_DB_NAME || 'shield',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(encodedName.length));
  } catch {
    return null;
  }
}

function isWellFormedSessionToken(token) {
  return /^[A-Za-z0-9_-]{32,160}$/u.test(token);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function getShieldAccountForRequest(req) {
  const token = getCookieValue(req, SHIELD_SESSION_COOKIE);
  if (!token || !isWellFormedSessionToken(token)) {
    return null;
  }

  const [rows] = await shieldPool.execute(
    `SELECT
      users.id,
      users.email,
      users.firstName,
      users.lastName,
      users.displayName,
      users.role,
      users.district,
      users.isActive
    FROM user_sessions
    INNER JOIN users ON users.id = user_sessions.userId
    WHERE user_sessions.tokenHash = ?
      AND user_sessions.revokedAt IS NULL
      AND user_sessions.expiresAt > NOW()
      AND users.isActive = 1
    LIMIT 1`,
    [hashToken(token)]
  );

  const account = rows[0];
  if (!account) {
    return null;
  }

  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    displayName: account.displayName || `${account.firstName || ''} ${account.lastName || ''}`.trim() || account.email,
    role: account.role,
    district: account.district,
    isActive: Boolean(account.isActive)
  };
}

async function requireShieldSession(req, res, next) {
  try {
    const account = await getShieldAccountForRequest(req);
    if (!account) {
      return res.status(401).json({ error: 'Sign in with Shield required' });
    }

    req.shieldAccount = account;
    return next();
  } catch (error) {
    console.error('Shield SSO validation error:', error);
    return res.status(500).json({ error: 'Unable to validate Shield session' });
  }
}

module.exports = {
  getShieldAccountForRequest,
  requireShieldSession
};
