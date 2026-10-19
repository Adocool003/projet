import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config.js';
import { getCity } from '../data/cities.js';
import { clearSessionCookie } from '../auth.js';
import { featuresOf } from '../plans.js';
import { GENDERS, getUser, INTERESTS, ownProfile, photosOf } from '../services/profiles.js';
import { HttpError, parseJson } from '../services/util.js';
import { ah, validate } from '../services/validate.js';

export const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const updateSchema = z.object({
  name: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(500),
  job: z.string().trim().max(60),
  gender: z.enum(GENDERS),
  showMe: z.array(z.enum(GENDERS)).min(1),
  interests: z.array(z.enum(INTERESTS)).max(8),
  cityId: z.string(),
  travelCityId: z.string().nullable(),
  ageMin: z.number().int().min(18).max(99),
  ageMax: z.number().int().min(18).max(99),
  maxDistance: z.number().int().min(1).max(500),
  language: z.enum(['fr', 'en']),
  incognito: z.boolean(),
  marketingOptIn: z.boolean(),
  filters: z.object({
    requireBio: z.boolean().optional(),
    sharedInterests: z.boolean().optional(),
    activeRecently: z.boolean().optional(),
  }),
}).partial();

/** Vérifie la signature binaire du fichier (le type MIME envoyé n'est pas fiable). */
function detectImageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export function removePhotoFile(filename) {
  fs.rm(path.join(config.uploadDir, path.basename(filename)), { force: true }, () => {});
}

export function profileRoutes({ db }) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
  });

  router.get('/', (req, res) => {
    res.json({ user: ownProfile(db, req.user) });
  });

  router.patch('/', (req, res) => {
    const data = validate(updateSchema, req.body);
    const user = req.user;
    const features = featuresOf(user);
    const sets = {};

    for (const [key, col] of [['name', 'name'], ['bio', 'bio'], ['job', 'job'], ['gender', 'gender'], ['language', 'language']]) {
      if (data[key] !== undefined) sets[col] = data[key];
    }
    if (data.showMe) sets.show_me = JSON.stringify([...new Set(data.showMe)]);
    if (data.interests) sets.interests = JSON.stringify([...new Set(data.interests)]);
    if (data.maxDistance !== undefined) sets.max_distance = data.maxDistance;
    if (data.marketingOptIn !== undefined) sets.marketing_opt_in = data.marketingOptIn ? 1 : 0;

    const ageMin = data.ageMin ?? user.age_min;
    const ageMax = data.ageMax ?? user.age_max;
    if (ageMin > ageMax) throw new HttpError(400, 'invalid_age_range');
    sets.age_min = ageMin;
    sets.age_max = ageMax;

    if (data.cityId !== undefined) {
      const city = getCity(data.cityId);
      if (!city) throw new HttpError(400, 'invalid_city');
      Object.assign(sets, { city_id: city.id, lat: city.lat, lng: city.lng });
    }
    if (data.travelCityId !== undefined) {
      if (data.travelCityId !== null) {
        if (!features.travel) throw new HttpError(402, 'plan_required', { feature: 'travel' });
        if (!getCity(data.travelCityId)) throw new HttpError(400, 'invalid_city');
      }
      sets.travel_city_id = data.travelCityId;
    }
    if (data.incognito !== undefined) {
      if (data.incognito && !features.incognito) throw new HttpError(402, 'plan_required', { feature: 'incognito' });
      sets.incognito = data.incognito ? 1 : 0;
    }
    if (data.filters) {
      if (!features.advancedFilters && Object.values(data.filters).some(Boolean)) {
        throw new HttpError(402, 'plan_required', { feature: 'advancedFilters' });
      }
      sets.filters = JSON.stringify(data.filters);
    }

    if (data.marketingOptIn !== undefined && Boolean(user.marketing_opt_in) !== data.marketingOptIn) {
      db.prepare('INSERT INTO consents (user_id, type, version, granted) VALUES (?, ?, ?, ?)')
        .run(user.id, 'marketing', config.legalVersion, data.marketingOptIn ? 1 : 0);
    }

    const cols = Object.keys(sets);
    db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .run(...cols.map((c) => sets[c]), user.id);
    res.json({ user: ownProfile(db, getUser(db, user.id)) });
  });

  router.post('/photos', upload.single('photo'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'photo_required');
    const ext = detectImageType(req.file.buffer);
    if (!ext) throw new HttpError(400, 'invalid_image');
    const count = db.prepare('SELECT COUNT(*) AS n FROM photos WHERE user_id = ?').get(req.user.id).n;
    if (count >= MAX_PHOTOS) throw new HttpError(400, 'too_many_photos');

    const filename = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.mkdirSync(config.uploadDir, { recursive: true });
    fs.writeFileSync(path.join(config.uploadDir, filename), req.file.buffer);
    db.prepare('INSERT INTO photos (user_id, filename, position) VALUES (?, ?, ?)').run(req.user.id, filename, count);
    res.status(201).json({ photos: photosOf(db, req.user.id) });
  });

  router.delete('/photos/:id', (req, res) => {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
    if (!photo) throw new HttpError(404, 'not_found');
    db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
    removePhotoFile(photo.filename);
    res.json({ photos: photosOf(db, req.user.id) });
  });

  router.put('/photos/order', (req, res) => {
    const { ids } = validate(z.object({ ids: z.array(z.number().int()) }), req.body);
    const owned = new Set(photosOf(db, req.user.id).map((p) => p.id));
    if (ids.length !== owned.size || !ids.every((id) => owned.has(id))) throw new HttpError(400, 'invalid_order');
    const stmt = db.prepare('UPDATE photos SET position = ? WHERE id = ?');
    ids.forEach((id, i) => stmt.run(i, id));
    res.json({ photos: photosOf(db, req.user.id) });
  });

  // Droit à la portabilité (art. 20 RGPD) : export de toutes les données.
  router.get('/export', (req, res) => {
    const id = req.user.id;
    const { password_hash: _ph, ...account } = req.user;
    const data = {
      exportedAt: new Date().toISOString(),
      account: { ...account, show_me: parseJson(account.show_me, []), interests: parseJson(account.interests, []), filters: parseJson(account.filters, {}) },
      photos: photosOf(db, id),
      swipes: db.prepare('SELECT target_id, action, note, created_at FROM swipes WHERE swiper_id = ?').all(id),
      matches: db.prepare('SELECT id, user_a, user_b, created_at FROM matches WHERE user_a = ? OR user_b = ?').all(id, id),
      messagesSent: db.prepare('SELECT match_id, body, created_at, read_at FROM messages WHERE sender_id = ?').all(id),
      blocks: db.prepare('SELECT blocked_id, created_at FROM blocks WHERE blocker_id = ?').all(id),
      reportsFiled: db.prepare('SELECT reported_id, reason, details, status, created_at FROM reports WHERE reporter_id = ?').all(id),
      consents: db.prepare('SELECT type, version, granted, created_at FROM consents WHERE user_id = ?').all(id),
      billing: db.prepare('SELECT type, plan, amount_cents, currency, provider, created_at FROM billing_events WHERE user_id = ?').all(id),
    };
    res.setHeader('Content-Disposition', `attachment; filename="amora-donnees-${id}.json"`);
    res.json(data);
  });

  // Droit à l'effacement (art. 17 RGPD) : suppression définitive du compte.
  router.delete('/', ah(async (req, res) => {
    const { password } = validate(z.object({ password: z.string().min(1) }), req.body);
    if (!(await bcrypt.compare(password, req.user.password_hash))) throw new HttpError(401, 'invalid_credentials');
    await req.app.locals.payments.cancelImmediately(req.user);
    const photos = db.prepare('SELECT filename FROM photos WHERE user_id = ?').all(req.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    photos.forEach((p) => removePhotoFile(p.filename));
    clearSessionCookie(res);
    res.json({ ok: true });
  }));

  return router;
}
