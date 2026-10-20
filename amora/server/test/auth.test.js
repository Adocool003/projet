import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthdateYearsAgo, request, setup, signup } from './helpers.js';

const base = {
  email: 'a@test.fr', password: 'motdepasse123', name: 'Anna', gender: 'femme', showMe: ['homme'],
  cityId: 'lyon', acceptTerms: true, acceptSensitiveData: true,
};

test("l'inscription est refusée aux mineurs", async () => {
  const { app } = setup();
  const res = await request(app).post('/api/auth/signup').send({ ...base, birthdate: birthdateYearsAgo(17) });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'underage');
});

test('les consentements CGU et données sensibles sont obligatoires', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/auth/signup').send({ ...base, birthdate: birthdateYearsAgo(25), acceptSensitiveData: false });
  assert.equal(res.status, 400);
});

test('inscription, consentements journalisés, connexion et déconnexion', async () => {
  const { app, db } = setup();
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/signup').send({ ...base, birthdate: birthdateYearsAgo(25) });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.subscription.plan, 'free');
  assert.equal(res.body.user.city, 'Lyon');
  assert.equal(res.body.user.password_hash, undefined);
  const consents = db.prepare('SELECT type FROM consents WHERE user_id = ?').all(res.body.user.id).map((c) => c.type);
  assert.deepEqual(consents.sort(), ['marketing', 'sensitive_data', 'terms_privacy']);

  assert.equal((await agent.get('/api/auth/me')).status, 200);
  assert.equal((await request(app).post('/api/auth/signup').send({ ...base, birthdate: birthdateYearsAgo(25) })).status, 409);
  await agent.post('/api/auth/logout');
  assert.equal((await agent.get('/api/auth/me')).status, 401);

  const bad = await request(app).post('/api/auth/login').send({ email: base.email, password: 'mauvais' });
  assert.equal(bad.status, 401);
  const ok = await request(app).post('/api/auth/login').send({ email: 'A@TEST.FR', password: base.password });
  assert.equal(ok.status, 200);
});

test('les routes protégées exigent une session', async () => {
  const { app } = setup();
  assert.equal((await request(app).get('/api/discover')).status, 401);
  assert.equal((await request(app).get('/api/matches')).status, 401);
});

test('un membre banni ne peut plus utiliser son compte', async () => {
  const { app, db } = setup();
  const { agent, user } = await signup(app);
  db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(user.id);
  assert.equal((await agent.get('/api/discover')).status, 403);
});

test('les métadonnées publiques exposent les formules en euros', async () => {
  const { app } = setup();
  const res = await request(app).get('/api/meta');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.plans.map((p) => [p.id, p.priceCents]), [['free', 0], ['plus', 999], ['gold', 1999], ['platinum', 2999]]);
  assert.ok(res.body.plans.every((p) => p.currency === 'eur' && p.interval === 'month'));
  assert.equal(res.body.paymentsMode, 'demo');
});
