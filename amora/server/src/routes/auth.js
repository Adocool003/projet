import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { getCity } from '../data/cities.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../auth.js';
import { GENDERS, getUser, ownProfile } from '../services/profiles.js';
import { ageFrom, HttpError } from '../services/util.js';
import { ah, validate } from '../services/validate.js';

const MIN_AGE = 18;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(40),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(GENDERS),
  showMe: z.array(z.enum(GENDERS)).min(1),
  cityId: z.string(),
  language: z.enum(['fr', 'en']).default('fr'),
  // Consentements RGPD : CGU + traitement des données sensibles (orientation
  // sexuelle déduite des préférences, art. 9 RGPD) sont obligatoires pour
  // utiliser un service de rencontre ; la prospection commerciale est facultative.
  acceptTerms: z.literal(true),
  acceptSensitiveData: z.literal(true),
  marketingOptIn: z.boolean().default(false),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export function authRoutes({ db }) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isTest ? 10_000 : 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
  });

  router.post('/signup', limiter, ah(async (req, res) => {
    const data = validate(signupSchema, req.body);
    const birth = new Date(`${data.birthdate}T00:00:00Z`);
    if (Number.isNaN(birth.getTime()) || birth > new Date()) throw new HttpError(400, 'invalid_birthdate');
    const age = ageFrom(data.birthdate);
    if (age < MIN_AGE) throw new HttpError(403, 'underage');
    if (age > 120) throw new HttpError(400, 'invalid_birthdate');
    const city = getCity(data.cityId);
    if (!city) throw new HttpError(400, 'invalid_city');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) {
      throw new HttpError(409, 'email_taken');
    }

    const hash = await bcrypt.hash(data.password, config.isTest ? 4 : 12);
    const ageMin = Math.max(MIN_AGE, age - 8);
    const ageMax = Math.max(ageMin + 2, age + 8);
    const info = db.prepare(`
      INSERT INTO users (email, password_hash, name, birthdate, gender, show_me, city_id, lat, lng,
                         age_min, age_max, language, marketing_opt_in)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.email, hash, data.name, data.birthdate, data.gender, JSON.stringify(data.showMe),
      city.id, city.lat, city.lng, ageMin, ageMax, data.language, data.marketingOptIn ? 1 : 0,
    );
    const userId = Number(info.lastInsertRowid);
    const consent = db.prepare('INSERT INTO consents (user_id, type, version, granted) VALUES (?, ?, ?, ?)');
    consent.run(userId, 'terms_privacy', config.legalVersion, 1);
    consent.run(userId, 'sensitive_data', config.legalVersion, 1);
    consent.run(userId, 'marketing', config.legalVersion, data.marketingOptIn ? 1 : 0);

    setSessionCookie(res, userId);
    res.status(201).json({ user: ownProfile(db, getUser(db, userId)) });
  }));

  router.post('/login', limiter, ah(async (req, res) => {
    const data = validate(loginSchema, req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
    const ok = user && (await bcrypt.compare(data.password, user.password_hash));
    if (!ok) throw new HttpError(401, 'invalid_credentials');
    if (user.banned) throw new HttpError(403, 'banned');
    setSessionCookie(res, user.id);
    res.json({ user: ownProfile(db, user) });
  }));

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth(db), (req, res) => {
    res.json({ user: ownProfile(db, req.user) });
  });

  return router;
}
