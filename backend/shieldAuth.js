const crypto = require('crypto');
const mysql = require('mysql2/promise');

const SHIELD_SESSION_COOKIE = 'shield_session';
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = 'sha512';
const SESSION_DAYS = 7;

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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

function hashPassword(password, salt) {
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST)
    .toString('hex');

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPasswordHash) {
  const [salt, storedHash] = String(storedPasswordHash || '').split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const attemptedHash = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(attemptedHash, 'hex'));
}

function publicAccount(account) {
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

  return publicAccount(account);
}

async function createShieldSession(userId) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const id = crypto.randomUUID();

  await shieldPool.execute(
    `INSERT INTO user_sessions (
      id,
      userId,
      tokenHash,
      expiresAt
    ) VALUES (?, ?, ?, ?)`,
    [id, userId, hashToken(token), expiresAt]
  );

  return token;
}

function setShieldSessionCookie(req, res, token) {
  const sameSite = (process.env.SESSION_COOKIE_SAMESITE || 'lax').trim().toLowerCase();
  const secureSetting = (process.env.SESSION_COOKIE_SECURE || 'false').trim().toLowerCase();
  const secure = sameSite === 'none' ? true : secureSetting === 'true';

  res.cookie(SHIELD_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

async function loginWithShieldCredentials(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  const [rows] = await shieldPool.execute(
    `SELECT
      id,
      email,
      firstName,
      lastName,
      displayName,
      role,
      district,
      isActive,
      passwordHash,
      twoFactorEnabled
    FROM users
    WHERE LOWER(email) = ?
      AND passwordHash IS NOT NULL
    LIMIT 1`,
    [email]
  );

  const account = rows[0];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!account.isActive) {
    return res.status(403).json({ error: 'This account is inactive. Contact an administrator.' });
  }

  if (account.twoFactorEnabled) {
    return res.status(409).json({
      error: 'This Shield account requires two-factor sign-in. Sign into Shield first, then open BlueDoc.'
    });
  }

  const token = await createShieldSession(account.id);
  setShieldSessionCookie(req, res, token);

  return res.json({
    authenticated: true,
    account: publicAccount(account)
  });
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
  loginWithShieldCredentials,
  requireShieldSession
};
