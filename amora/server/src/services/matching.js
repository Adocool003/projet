import { effectivePlanId, featuresOf, PLANS } from '../plans.js';
import { publicProfile, searchLocation } from './profiles.js';
import { ageFrom, birthdateForAge, dayKey, distanceKm, HttpError, parseJson } from './util.js';

const DECK_SIZE = 20;
const RECENT_MS = 7 * 24 * 3600 * 1000;

export function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export function isBlockedBetween(db, a, b) {
  return Boolean(db.prepare(
    'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
  ).get(a, b, b, a));
}

export function findMatch(db, a, b) {
  const [x, y] = orderedPair(a, b);
  return db.prepare('SELECT * FROM matches WHERE user_a = ? AND user_b = ?').get(x, y);
}

/** Quotas du jour (likes / super likes) pour un membre. */
export function usageToday(db, user) {
  const row = db.prepare('SELECT likes, superlikes FROM usage WHERE user_id = ? AND day = ?').get(user.id, dayKey());
  const f = featuresOf(user);
  const likes = row?.likes ?? 0;
  const superlikes = row?.superlikes ?? 0;
  return {
    likesRemaining: f.dailyLikes === null ? null : Math.max(0, f.dailyLikes - likes),
    superLikesRemaining: Math.max(0, f.dailySuperLikes - superlikes),
  };
}

function bumpUsage(db, userId, column) {
  db.prepare(`
    INSERT INTO usage (user_id, day, ${column}) VALUES (?, ?, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET ${column} = ${column} + 1
  `).run(userId, dayKey());
}

/**
 * Pile de profils à proposer. Critères réciproques : chacun correspond au
 * genre recherché et à la tranche d'âge de l'autre. Les profils déjà vus,
 * bloqués, bannis ou en mode incognito (sauf s'ils nous ont liké) sont exclus.
 */
export function discover(db, user) {
  const me = searchLocation(user);
  const myAge = ageFrom(user.birthdate);
  const showMe = parseJson(user.show_me, []);
  const myFeatures = featuresOf(user);
  const filters = myFeatures.advancedFilters ? parseJson(user.filters, {}) : {};
  const myInterests = new Set(parseJson(user.interests, []));
  if (showMe.length === 0) return [];

  // Pré-filtre géographique grossier (boîte englobante) avant le calcul exact.
  const dLat = user.max_distance / 111;
  const dLng = user.max_distance / (111 * Math.max(0.2, Math.cos((me.lat * Math.PI) / 180)));

  const rows = db.prepare(`
    SELECT u.*,
      (SELECT action FROM swipes s WHERE s.swiper_id = u.id AND s.target_id = :me) AS their_action,
      (SELECT note FROM swipes s WHERE s.swiper_id = u.id AND s.target_id = :me) AS their_note
    FROM users u
    WHERE u.id != :me
      AND u.banned = 0
      AND u.gender IN (SELECT value FROM json_each(:showMe))
      AND EXISTS (SELECT 1 FROM json_each(u.show_me) WHERE value = :myGender)
      AND u.birthdate <= :maxBirth AND u.birthdate > :minBirth
      AND :myAge BETWEEN u.age_min AND u.age_max
      AND u.lat BETWEEN :latMin AND :latMax
      AND u.lng BETWEEN :lngMin AND :lngMax
      AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = :me AND s.target_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = :me AND b.blocked_id = u.id)
                                               OR (b.blocker_id = u.id AND b.blocked_id = :me))
    LIMIT 500
  `).all({
    me: user.id,
    showMe: JSON.stringify(showMe),
    myGender: user.gender,
    maxBirth: birthdateForAge(user.age_min),
    minBirth: birthdateForAge(user.age_max + 1),
    myAge,
    latMin: me.lat - dLat,
    latMax: me.lat + dLat,
    lngMin: me.lng - dLng,
    lngMax: me.lng + dLng,
  });

  const now = Date.now();
  const scored = [];
  for (const u of rows) {
    const theyLiked = u.their_action === 'like' || u.their_action === 'superlike';
    const uFeatures = PLANS[effectivePlanId(u)].features;
    if (u.incognito && uFeatures.incognito && !theyLiked) continue;
    const dist = distanceKm(me.lat, me.lng, u.lat, u.lng);
    if (dist > user.max_distance) continue;

    const interests = parseJson(u.interests, []);
    const shared = interests.filter((i) => myInterests.has(i)).length;
    const recentlyActive = now - new Date(u.last_active).getTime() < RECENT_MS;
    if (filters.requireBio && !u.bio.trim()) continue;
    if (filters.sharedInterests && shared === 0) continue;
    if (filters.activeRecently && !recentlyActive) continue;

    let score = Math.random() * 10;
    score += shared * 4;
    score += Math.max(0, 20 - dist / 5);
    if (recentlyActive) score += 10;
    if (theyLiked) score += 15;
    if (u.their_action === 'superlike') score += 25;
    if (u.boost_until && new Date(u.boost_until).getTime() > now) score += 60;
    if (uFeatures.priority) score += 12;
    scored.push({ u, score, superLikedMe: u.their_action === 'superlike', note: u.their_note });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, DECK_SIZE).map(({ u, superLikedMe, note }) => ({
    ...publicProfile(db, u, user),
    superLikedMe,
    superLikeNote: superLikedMe ? note || null : null,
  }));
}

/**
 * Enregistre un swipe. Renvoie le match créé si l'intérêt est réciproque.
 * Lève une erreur 402 si le quota de la formule est atteint.
 */
export function swipe(db, user, { targetId, action, note }) {
  if (targetId === user.id) throw new HttpError(400, 'invalid_target');
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND banned = 0').get(targetId);
  if (!target) throw new HttpError(404, 'not_found');
  if (isBlockedBetween(db, user.id, targetId)) throw new HttpError(404, 'not_found');
  if (db.prepare('SELECT 1 FROM swipes WHERE swiper_id = ? AND target_id = ?').get(user.id, targetId)) {
    throw new HttpError(409, 'already_swiped');
  }

  const features = featuresOf(user);
  const usage = usageToday(db, user);
  if (action === 'like' && usage.likesRemaining === 0) {
    throw new HttpError(402, 'quota_exceeded', { feature: 'dailyLikes' });
  }
  if (action === 'superlike' && usage.superLikesRemaining === 0) {
    throw new HttpError(402, 'quota_exceeded', { feature: 'dailySuperLikes' });
  }
  if (note && !(action === 'superlike' && features.superLikeNote)) {
    throw new HttpError(402, 'plan_required', { feature: 'superLikeNote' });
  }

  db.prepare('INSERT INTO swipes (swiper_id, target_id, action, note) VALUES (?, ?, ?, ?)')
    .run(user.id, targetId, action, note || null);
  if (action === 'like') bumpUsage(db, user.id, 'likes');
  if (action === 'superlike') bumpUsage(db, user.id, 'superlikes');

  let match = null;
  if (action !== 'pass') {
    const reciprocal = db.prepare(
      "SELECT 1 FROM swipes WHERE swiper_id = ? AND target_id = ? AND action IN ('like','superlike')",
    ).get(targetId, user.id);
    if (reciprocal) {
      const [a, b] = orderedPair(user.id, targetId);
      db.prepare('INSERT OR IGNORE INTO matches (user_a, user_b) VALUES (?, ?)').run(a, b);
      match = findMatch(db, a, b);
    }
  }
  return { match, target, usage: usageToday(db, user) };
}

/** Annule le dernier swipe (hors match), réservé aux formules payantes. */
export function rewind(db, user) {
  if (!featuresOf(user).rewind) throw new HttpError(402, 'plan_required', { feature: 'rewind' });
  const last = db.prepare('SELECT * FROM swipes WHERE swiper_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
  if (!last) throw new HttpError(404, 'nothing_to_rewind');
  if (findMatch(db, user.id, last.target_id)) throw new HttpError(409, 'already_matched');
  db.prepare('DELETE FROM swipes WHERE id = ?').run(last.id);
  // Le like annulé est rendu au quota du jour s'il date d'aujourd'hui.
  if (last.action !== 'pass' && dayKey(new Date(last.created_at)) === dayKey()) {
    const col = last.action === 'like' ? 'likes' : 'superlikes';
    db.prepare(`UPDATE usage SET ${col} = MAX(0, ${col} - 1) WHERE user_id = ? AND day = ?`).run(user.id, dayKey());
  }
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(last.target_id);
  return target ? publicProfile(db, target, user) : null;
}

/** Profils qui m'ont liké et que je n'ai pas encore traités. */
export function likesReceived(db, user) {
  return db.prepare(`
    SELECT u.*, s.action AS their_action, s.note AS their_note, s.created_at AS liked_at
    FROM swipes s JOIN users u ON u.id = s.swiper_id
    WHERE s.target_id = ? AND s.action IN ('like','superlike') AND u.banned = 0
      AND NOT EXISTS (SELECT 1 FROM swipes m WHERE m.swiper_id = ? AND m.target_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                                               OR (b.blocker_id = u.id AND b.blocked_id = ?))
    ORDER BY s.id DESC
  `).all(user.id, user.id, user.id, user.id);
}
