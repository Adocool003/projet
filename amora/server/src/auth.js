import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { HttpError, nowIso } from './services/util.js';

export const COOKIE_NAME = 'amora_session';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return Number(payload.sub) || null;
  } catch {
    return null;
  }
}

// Cookie strictement nécessaire (authentification) : il est exempté de
// consentement au sens de l'article 82 de la loi Informatique et Libertés.
export function setSessionCookie(res, userId) {
  res.cookie(COOKIE_NAME, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Middleware : exige un membre connecté, non banni. Charge req.user. */
export function requireAuth(db) {
  const touch = db.prepare('UPDATE users SET last_active = ? WHERE id = ?');
  return (req, _res, next) => {
    const userId = verifyToken(req.cookies?.[COOKIE_NAME]);
    if (!userId) return next(new HttpError(401, 'unauthenticated'));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return next(new HttpError(401, 'unauthenticated'));
    if (user.banned) return next(new HttpError(403, 'banned'));
    req.user = user;
    // Mise à jour de l'activité au plus une fois par minute
    if (Date.now() - new Date(user.last_active).getTime() > 60_000) touch.run(nowIso(), user.id);
    next();
  };
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'forbidden'));
  next();
}
