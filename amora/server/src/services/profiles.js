import { getCity } from '../data/cities.js';
import { effectivePlanId, featuresOf, PLANS } from '../plans.js';
import { ageFrom, distanceKm, monthKey, parseJson } from './util.js';

export const GENDERS = ['homme', 'femme', 'non_binaire'];

export const INTERESTS = [
  'voyage', 'cuisine', 'sport', 'musique', 'cinema', 'lecture', 'randonnee', 'jeux_video',
  'art', 'photo', 'danse', 'yoga', 'animaux', 'mode', 'tech', 'nature', 'fete', 'vin',
  'cafe', 'theatre', 'series', 'football', 'running', 'mer', 'montagne', 'benevolat',
];

export function photoUrl(filename) {
  return `/uploads/${filename}`;
}

export function photosOf(db, userId) {
  return db
    .prepare('SELECT id, filename FROM photos WHERE user_id = ? ORDER BY position, id')
    .all(userId)
    .map((p) => ({ id: p.id, url: photoUrl(p.filename) }));
}

/** Position utilisée pour la découverte (ville de voyage si mode voyage actif). */
export function searchLocation(user) {
  if (user.travel_city_id && featuresOf(user).travel) {
    const c = getCity(user.travel_city_id);
    if (c) return { lat: c.lat, lng: c.lng, cityId: c.id };
  }
  return { lat: user.lat, lng: user.lng, cityId: user.city_id };
}

/**
 * Profil visible par les autres membres. Ne contient jamais l'e-mail, la date
 * de naissance ni les coordonnées : uniquement l'âge, la ville et une distance
 * arrondie au km.
 */
export function publicProfile(db, user, viewer) {
  const city = getCity(user.city_id);
  let distance = null;
  if (viewer) {
    const from = searchLocation(viewer);
    distance = Math.max(1, Math.round(distanceKm(from.lat, from.lng, user.lat, user.lng)));
  }
  return {
    id: user.id,
    name: user.name,
    age: ageFrom(user.birthdate),
    gender: user.gender,
    bio: user.bio,
    job: user.job,
    interests: parseJson(user.interests, []),
    city: city ? city.name : null,
    country: city ? city.country : null,
    distanceKm: distance,
    photos: photosOf(db, user.id),
    // Badge affiché sur les profils premium (hors formule gratuite)
    premium: effectivePlanId(user) !== 'free',
  };
}

export function ownProfile(db, user) {
  const planId = effectivePlanId(user);
  const features = PLANS[planId].features;
  const month = monthKey();
  const boostsUsed = user.boosts_period === month ? user.boosts_used : 0;
  return {
    ...publicProfile(db, user, null),
    email: user.email,
    birthdate: user.birthdate,
    showMe: parseJson(user.show_me, []),
    cityId: user.city_id,
    travelCityId: features.travel ? user.travel_city_id : null,
    ageMin: user.age_min,
    ageMax: user.age_max,
    maxDistance: user.max_distance,
    filters: parseJson(user.filters, {}),
    language: user.language,
    role: user.role,
    incognito: Boolean(user.incognito) && features.incognito,
    marketingOptIn: Boolean(user.marketing_opt_in),
    boostUntil: user.boost_until && new Date(user.boost_until) > new Date() ? user.boost_until : null,
    boostsRemaining: Math.max(0, features.monthlyBoosts - boostsUsed),
    subscription: {
      plan: planId,
      expiresAt: planId === 'free' ? null : user.plan_expires_at,
      cancelAtPeriodEnd: Boolean(user.plan_cancel_at_period_end),
      provider: user.plan_provider,
    },
    features,
    createdAt: user.created_at,
  };
}

export function getUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
