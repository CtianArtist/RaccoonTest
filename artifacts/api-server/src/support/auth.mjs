import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './schema.mjs';
const scrypt = promisify(scryptCb);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const digest = s => createHash('sha256').update(s).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, scryptOptions);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = await scrypt(password, salt, 64, scryptOptions);
  return hash?.length === 128 && timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function newSession(userId, res) {
  const token = randomToken(), csrf = randomToken();
  await pool.query('INSERT INTO rsc_sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval \'7 days\')', [digest(token), userId, csrf]);
  res.cookie('rsc_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 86400000 });
  return csrf;
}
export async function session(req, res, next) {
  const token = req.cookies?.rsc_session;
  if (typeof token === 'string' && token.length < 200) {
    const { rows } = await pool.query('SELECT u.id,u.email,u.display_name,u.role,s.csrf,s.token_hash FROM rsc_sessions s JOIN rsc_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [digest(token)]);
    if (rows[0]) res.locals.user = rows[0];
  }
  next();
}
export async function limit(req, res, next) {
  const authRoute = /\/auth\/(login|register)$/.test(req.path);
  const cap = authRoute ? 15 : 150;
  const window = authRoute ? 900 : 60;
  const key = digest(`${authRoute ? 'auth' : 'api'}:${req.ip}`);
  const { rows } = await pool.query(`INSERT INTO rsc_limits(key,count,resets_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rsc_limits.resets_at<now() THEN 1 ELSE rsc_limits.count+1 END,
    resets_at=CASE WHEN rsc_limits.resets_at<now() THEN now()+$2*interval '1 second' ELSE rsc_limits.resets_at END RETURNING count`, [key, window]);
  if (rows[0].count > cap) return res.status(429).set('Retry-After', String(window)).json({ error: 'Too many requests. Try again later.' });
  next();
}
export function requireUser(_req, res, next) {
  if (!res.locals.user) return res.status(401).json({ error: 'Sign in is required.' });
  return next();
}
export function requireRole(...roles) {
  return (_req, res, next) => !res.locals.user ? res.status(401).json({ error: 'Sign in is required.' }) :
    !roles.includes(res.locals.user.role) ? res.status(403).json({ error: 'Permission denied.' }) : next();
}
export function mutationGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== process.env.PUBLIC_ORIGIN) return res.status(403).json({ error: 'Origin is not permitted.' });
  if (res.locals.user && !safeEqual(req.get('x-csrf-token') || req.body?.csrf, res.locals.user.csrf)) return res.status(403).json({ error: 'Invalid request token.' });
  return next();
}
export async function serviceOrSession(scope, req, res) {
  if (res.locals.user) return res.locals.user;
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length > 250) return null;
  const { rows } = await pool.query(`SELECT c.id AS credential_id,c.customer_id AS id,c.scopes,u.role
    FROM rsc_service_credentials c JOIN rsc_users u ON u.id=c.customer_id
    WHERE c.token_hash=$1 AND c.expires_at>now() AND NOT c.revoked`, [digest(authorization.slice(7))]);
  const credential = rows[0];
  if (!credential?.scopes.includes(scope)) return null;
  res.locals.service = credential;
  return { id: credential.id, role: 'customer' };
}
