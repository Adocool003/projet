import { Router } from 'express';
import { z } from 'zod';
import { BOOST_MINUTES, featuresOf } from '../plans.js';
import { discover, likesReceived, rewind, swipe, usageToday } from '../services/matching.js';
import { getUser, ownProfile, publicProfile } from '../services/profiles.js';
import { HttpError, monthKey } from '../services/util.js';
import { validate } from '../services/validate.js';
import { matchSummary } from './matches.js';

const swipeSchema = z.object({
  targetId: z.number().int().positive(),
  action: z.enum(['like', 'pass', 'superlike']),
  note: z.string().trim().max(140).optional(),
});

export function discoverRoutes({ db, realtime }) {
  const router = Router();

  router.get('/discover', (req, res) => {
    res.json({ profiles: discover(db, req.user), usage: usageToday(db, req.user) });
  });

  router.post('/swipes', (req, res) => {
    const data = validate(swipeSchema, req.body);
    const { match, target, usage } = swipe(db, req.user, data);
    let payload = null;
    if (match) {
      payload = matchSummary(db, match, req.user);
      realtime.emit(target.id, 'match:new', matchSummary(db, match, target));
    } else if (data.action !== 'pass') {
      realtime.emit(target.id, 'like:new', { superlike: data.action === 'superlike' });
    }
    res.status(201).json({ match: payload, usage });
  });

  router.post('/swipes/rewind', (req, res) => {
    const profile = rewind(db, req.user);
    res.json({ profile, usage: usageToday(db, req.user) });
  });

  // « Qui m'a liké » : liste complète pour Gold / Platinum, sinon seulement le
  // nombre (les vignettes sont floutées côté client).
  router.get('/likes', (req, res) => {
    const rows = likesReceived(db, req.user);
    if (!featuresOf(req.user).seeLikes) {
      return res.json({ locked: true, count: rows.length, profiles: [] });
    }
    res.json({
      locked: false,
      count: rows.length,
      profiles: rows.map((u) => ({
        ...publicProfile(db, u, req.user),
        superLikedMe: u.their_action === 'superlike',
        superLikeNote: u.their_action === 'superlike' ? u.their_note : null,
        likedAt: u.liked_at,
      })),
    });
  });

  router.post('/boost', (req, res) => {
    const user = req.user;
    const allowance = featuresOf(user).monthlyBoosts;
    if (allowance === 0) throw new HttpError(402, 'plan_required', { feature: 'monthlyBoosts' });
    if (user.boost_until && new Date(user.boost_until) > new Date()) throw new HttpError(409, 'boost_active');
    const month = monthKey();
    const used = user.boosts_period === month ? user.boosts_used : 0;
    if (used >= allowance) throw new HttpError(402, 'quota_exceeded', { feature: 'monthlyBoosts' });
    const until = new Date(Date.now() + BOOST_MINUTES * 60_000).toISOString();
    db.prepare('UPDATE users SET boost_until = ?, boosts_period = ?, boosts_used = ? WHERE id = ?')
      .run(until, month, used + 1, user.id);
    res.json({ user: ownProfile(db, getUser(db, user.id)) });
  });

  return router;
}
