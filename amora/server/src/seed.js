// Données de démonstration : crée des profils fictifs (avec avatars SVG
// générés) répartis dans plusieurs villes, un compte démo et un compte admin.
// Usage : npm run seed            (ajoute les profils s'ils n'existent pas)
//         npm run seed -- --reset (vide la base avant)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { openDb } from './db.js';
import { getCity } from './data/cities.js';
import { INTERESTS } from './services/profiles.js';

const FEMALE = ['Camille', 'Léa', 'Chloé', 'Manon', 'Inès', 'Jade', 'Louise', 'Emma', 'Sarah', 'Zoé', 'Lina', 'Julie', 'Clara', 'Alice', 'Anaïs', 'Yasmine', 'Lucie', 'Nina', 'Eva', 'Margaux'];
const MALE = ['Lucas', 'Hugo', 'Louis', 'Nathan', 'Gabriel', 'Arthur', 'Jules', 'Adam', 'Théo', 'Raphaël', 'Mehdi', 'Tom', 'Enzo', 'Maxime', 'Antoine', 'Paul', 'Samuel', 'Yanis', 'Victor', 'Noah'];
const NB = ['Alex', 'Charlie', 'Sacha', 'Eden', 'Camille', 'Andréa'];
const JOBS = ['Infirmière', 'Développeur', 'Graphiste', 'Professeur', 'Architecte', 'Barista', 'Étudiant·e', 'Avocate', 'Chef cuisinier', 'Photographe', 'Ingénieure', 'Commercial', 'Kiné', 'Journaliste', 'Pompier', 'Designer UX', ''];
const BIOS = [
  'Amateur·rice de brunchs et de balades au bord de l\'eau ☀️',
  'Toujours partant·e pour un concert ou une expo improvisée.',
  'Je cherche quelqu\'un avec qui partager mes meilleures adresses.',
  'Randonnées le week-end, séries le soir. Et toi ?',
  'Fan de cuisine italienne et de voyages en train 🚆',
  'Plutôt café que thé. Plutôt montagne que plage. On en discute ?',
  'Nouveau·elle en ville, envie de découvrir des gens sympas.',
  'Le sport me garde en forme, les fous rires aussi 😄',
  '',
];
const CITY_IDS = ['paris', 'paris', 'paris', 'paris', 'paris', 'paris', 'lyon', 'lyon', 'marseille', 'bordeaux', 'lille', 'toulouse', 'nantes', 'nice', 'strasbourg', 'montpellier', 'rennes', 'bruxelles', 'barcelone', 'berlin'];
const PALETTES = [['#ff5f6d', '#ffc371'], ['#7f53ac', '#647dee'], ['#11998e', '#38ef7d'], ['#f857a6', '#ff5858'], ['#4facfe', '#00f2fe'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867'], ['#f093fb', '#f5576c']];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// Générateur pseudo-aléatoire déterministe pour un jeu de données stable.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function avatarSvg(name, [c1, c2], variant) {
  const initial = name[0].toUpperCase();
  const circles = [0, 1, 2].map((i) => {
    const x = 60 + ((variant * 97 + i * 173) % 480);
    const y = 80 + ((variant * 61 + i * 211) % 640);
    const r = 60 + ((variant * 13 + i * 37) % 120);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.12"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="600" height="800" fill="url(#g)"/>${circles}
<text x="300" y="470" font-family="Helvetica, Arial, sans-serif" font-size="260" font-weight="700" fill="#fff" text-anchor="middle" opacity="0.92">${initial}</text>
</svg>`;
}

export async function seed(db, { count = 160, reset = false, log = console.log } = {}) {
  if (reset) {
    db.exec('DELETE FROM messages; DELETE FROM matches; DELETE FROM swipes; DELETE FROM photos; DELETE FROM blocks; DELETE FROM reports; DELETE FROM usage; DELETE FROM consents; DELETE FROM billing_events; DELETE FROM users;');
  }
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const rnd = mulberry32(42);
  const hash = await bcrypt.hash('motdepasse123', 10);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash, name, birthdate, gender, show_me, bio, job, interests,
      city_id, lat, lng, age_min, age_max, max_distance, role, plan, plan_expires_at, plan_provider, last_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPhoto = db.prepare('INSERT INTO photos (user_id, filename, position) VALUES (?, ?, ?)');
  const insertConsent = db.prepare('INSERT INTO consents (user_id, type, version, granted) VALUES (?, ?, ?, 1)');
  const in30d = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  function create({ email, name, gender, showMe, age, cityId, role = 'user', plan = 'free', bio, job, photos = 2, interests }) {
    const city = getCity(cityId);
    const year = new Date().getFullYear() - age;
    const birthdate = `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 27)).padStart(2, '0')}`;
    const lastActive = new Date(Date.now() - Math.floor(rnd() * 10 * 24 * 3600 * 1000)).toISOString();
    const info = insertUser.run(
      email, hash, name, birthdate, gender, JSON.stringify(showMe), bio ?? pick(BIOS, rnd), job ?? pick(JOBS, rnd),
      JSON.stringify(interests ?? [...new Set(Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => pick(INTERESTS, rnd)))]),
      city.id, city.lat, city.lng, Math.max(18, age - 10), age + 10, 100, role,
      plan, plan === 'free' ? null : in30d, plan === 'free' ? null : 'demo', lastActive,
    );
    if (!info.changes) return null;
    const id = Number(info.lastInsertRowid);
    for (let i = 0; i < photos; i++) {
      const filename = `seed-${crypto.randomBytes(8).toString('hex')}.svg`;
      fs.writeFileSync(path.join(config.uploadDir, filename), avatarSvg(name, pick(PALETTES, rnd), id * 7 + i));
      insertPhoto.run(id, filename, i);
    }
    insertConsent.run(id, 'terms_privacy', config.legalVersion);
    insertConsent.run(id, 'sensitive_data', config.legalVersion);
    return id;
  }

  create({ email: 'admin@amora.local', name: 'Admin', gender: 'femme', showMe: [], age: 35, cityId: 'paris', role: 'admin', plan: 'platinum', photos: 1 });
  const demoId = create({
    email: 'demo@amora.local', name: 'Alex', gender: 'homme', showMe: ['femme'], age: 29, cityId: 'paris',
    bio: 'Compte de démonstration 👋', job: 'Développeur', interests: ['voyage', 'cuisine', 'musique', 'randonnee'],
  });

  const ids = [];
  for (let i = 0; i < count; i++) {
    const r = rnd();
    const gender = r < 0.47 ? 'femme' : r < 0.94 ? 'homme' : 'non_binaire';
    const name = pick(gender === 'femme' ? FEMALE : gender === 'homme' ? MALE : NB, rnd);
    const o = rnd();
    const opposite = gender === 'femme' ? ['homme'] : gender === 'homme' ? ['femme'] : ['femme', 'homme', 'non_binaire'];
    const showMe = o < 0.8 ? opposite : o < 0.9 ? [gender] : ['femme', 'homme', 'non_binaire'];
    const p = rnd();
    const plan = p < 0.7 ? 'free' : p < 0.85 ? 'plus' : p < 0.95 ? 'gold' : 'platinum';
    const id = create({
      email: `membre${i + 1}@amora.local`, name, gender, showMe, age: 19 + Math.floor(rnd() * 26),
      cityId: pick(CITY_IDS, rnd), plan, photos: 1 + Math.floor(rnd() * 3),
    });
    if (id) ids.push(id);
  }

  // Quelques membres ont déjà liké le compte démo, pour montrer « Qui m'a liké ».
  if (demoId) {
    const likers = db.prepare(`SELECT id FROM users WHERE gender = 'femme' AND show_me LIKE '%"homme"%' AND id != ? LIMIT 6`).all(demoId);
    const like = db.prepare('INSERT OR IGNORE INTO swipes (swiper_id, target_id, action, note) VALUES (?, ?, ?, ?)');
    likers.forEach((u, i) => like.run(u.id, demoId, i === 0 ? 'superlike' : 'like', i === 0 ? 'Ton profil m\'a fait sourire 😊' : null));
  }

  log(`Seed terminé : ${ids.length} profils créés. Comptes : demo@amora.local / admin@amora.local (mot de passe : motdepasse123)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const db = openDb();
  await seed(db, { reset: process.argv.includes('--reset') });
}
