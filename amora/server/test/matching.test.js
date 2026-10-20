import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthdateYearsAgo, setPlan, setup, signup } from './helpers.js';

async function pair(app) {
  const man = await signup(app, { gender: 'homme', showMe: ['femme'] });
  const woman = await signup(app, { gender: 'femme', showMe: ['homme'] });
  return { man, woman };
}

test('la découverte respecte les préférences réciproques, la distance et l\'âge', async () => {
  const { app } = setup();
  const { man, woman } = await pair(app);
  await signup(app, { gender: 'homme', showMe: ['homme'] });                           // pas intéressé
  await signup(app, { gender: 'femme', showMe: ['femme'] });                           // pas intéressée par un homme
  await signup(app, { gender: 'femme', showMe: ['homme'], cityId: 'marseille' });      // trop loin
  await signup(app, { gender: 'femme', showMe: ['homme'], birthdate: birthdateYearsAgo(55) }); // hors tranche d'âge

  const res = await man.agent.get('/api/discover');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.profiles.map((p) => p.id), [woman.user.id]);
  const card = res.body.profiles[0];
  assert.equal(card.email, undefined);
  assert.equal(card.birthdate, undefined);
  assert.equal(card.distanceKm, 1);
});

test('un like réciproque crée un match et notifie l\'autre membre', async () => {
  const { app, events } = setup();
  const { man, woman } = await pair(app);
  const first = await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'like' });
  assert.equal(first.status, 201);
  assert.equal(first.body.match, null);
  assert.ok(events.some((e) => e.userId === woman.user.id && e.event === 'like:new'));

  const second = await woman.agent.post('/api/swipes').send({ targetId: man.user.id, action: 'like' });
  assert.equal(second.body.match.user.id, man.user.id);
  assert.ok(events.some((e) => e.userId === man.user.id && e.event === 'match:new'));

  assert.equal((await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'like' })).status, 409);
  const discover = await man.agent.get('/api/discover');
  assert.equal(discover.body.profiles.length, 0);
});

test('le quota de likes quotidien de la formule gratuite est appliqué', async () => {
  const { app, db } = setup();
  const { man } = await pair(app);
  const targets = [];
  for (let i = 0; i < 31; i++) targets.push((await signup(app, { gender: 'femme', showMe: ['homme'] })).user.id);
  for (let i = 0; i < 30; i++) {
    const res = await man.agent.post('/api/swipes').send({ targetId: targets[i], action: 'like' });
    assert.equal(res.status, 201, `like ${i}`);
  }
  const blocked = await man.agent.post('/api/swipes').send({ targetId: targets[30], action: 'like' });
  assert.equal(blocked.status, 402);
  assert.equal(blocked.body.feature, 'dailyLikes');
  // Passer reste toujours possible
  assert.equal((await man.agent.post('/api/swipes').send({ targetId: targets[30], action: 'pass' })).status, 201);

  setPlan(db, man.user.id, 'plus');
  const other = (await signup(app, { gender: 'femme', showMe: ['homme'] })).user.id;
  assert.equal((await man.agent.post('/api/swipes').send({ targetId: other, action: 'like' })).status, 201);
});

test('super like : quota et message joint réservé à Platinum', async () => {
  const { app, db } = setup();
  const { man, woman } = await pair(app);
  const other = await signup(app, { gender: 'femme', showMe: ['homme'] });
  const withNote = await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'superlike', note: 'Salut !' });
  assert.equal(withNote.status, 402);
  assert.equal(withNote.body.feature, 'superLikeNote');

  assert.equal((await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'superlike' })).status, 201);
  const second = await man.agent.post('/api/swipes').send({ targetId: other.user.id, action: 'superlike' });
  assert.equal(second.status, 402);

  setPlan(db, man.user.id, 'platinum');
  const third = await signup(app, { gender: 'femme', showMe: ['homme'] });
  assert.equal((await man.agent.post('/api/swipes').send({ targetId: third.user.id, action: 'superlike', note: 'Salut !' })).status, 201);
  const seen = await third.agent.get('/api/discover');
  const card = seen.body.profiles.find((p) => p.id === man.user.id);
  assert.equal(card.superLikedMe, true);
  assert.equal(card.superLikeNote, 'Salut !');
});

test('retour arrière réservé aux formules payantes', async () => {
  const { app, db } = setup();
  const { man, woman } = await pair(app);
  await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'pass' });
  assert.equal((await man.agent.post('/api/swipes/rewind')).status, 402);
  setPlan(db, man.user.id, 'plus');
  const res = await man.agent.post('/api/swipes/rewind');
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.id, woman.user.id);
  const discover = await man.agent.get('/api/discover');
  assert.deepEqual(discover.body.profiles.map((p) => p.id), [woman.user.id]);
});

test('« Qui m\'a liké » est verrouillé hors Gold / Platinum', async () => {
  const { app, db } = setup();
  const { man, woman } = await pair(app);
  await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'like' });
  const locked = await woman.agent.get('/api/likes');
  assert.deepEqual([locked.body.locked, locked.body.count, locked.body.profiles.length], [true, 1, 0]);
  setPlan(db, woman.user.id, 'gold');
  const open = await woman.agent.get('/api/likes');
  assert.equal(open.body.locked, false);
  assert.equal(open.body.profiles[0].id, man.user.id);
});

test('mode incognito : visible uniquement par les profils likés', async () => {
  const { app, db } = setup();
  const { man, woman } = await pair(app);
  const other = await signup(app, { gender: 'homme', showMe: ['femme'] });
  assert.equal((await woman.agent.patch('/api/me').send({ incognito: true })).status, 402);
  setPlan(db, woman.user.id, 'platinum');
  assert.equal((await woman.agent.patch('/api/me').send({ incognito: true })).status, 200);
  assert.equal((await man.agent.get('/api/discover')).body.profiles.length, 0);
  await woman.agent.post('/api/swipes').send({ targetId: man.user.id, action: 'like' });
  assert.deepEqual((await man.agent.get('/api/discover')).body.profiles.map((p) => p.id), [woman.user.id]);
  assert.equal((await other.agent.get('/api/discover')).body.profiles.length, 0);
});

test('mode voyage : la découverte se fait depuis la ville choisie', async () => {
  const { app, db } = setup();
  const { man } = await pair(app);
  const berlin = await signup(app, { gender: 'femme', showMe: ['homme'], cityId: 'berlin' });
  assert.equal((await man.agent.patch('/api/me').send({ travelCityId: 'berlin' })).status, 402);
  setPlan(db, man.user.id, 'plus');
  await man.agent.patch('/api/me').send({ travelCityId: 'berlin' });
  // La Berlinoise cherche aussi des profils proches d'elle… mais l'homme est à Paris.
  const ids = (await man.agent.get('/api/discover')).body.profiles.map((p) => p.id);
  assert.deepEqual(ids, [berlin.user.id]);
});

test('boost mensuel selon la formule', async () => {
  const { app, db } = setup();
  const { man } = await pair(app);
  assert.equal((await man.agent.post('/api/boost')).status, 402);
  setPlan(db, man.user.id, 'gold');
  const res = await man.agent.post('/api/boost');
  assert.equal(res.status, 200);
  assert.ok(res.body.user.boostUntil);
  assert.equal(res.body.user.boostsRemaining, 0);
  assert.equal((await man.agent.post('/api/boost')).status, 409);
});

test('les filtres avancés sont réservés à Gold et plus', async () => {
  const { app, db } = setup();
  const { man } = await pair(app);
  assert.equal((await man.agent.patch('/api/me').send({ filters: { requireBio: true } })).status, 402);
  setPlan(db, man.user.id, 'gold');
  assert.equal((await man.agent.patch('/api/me').send({ filters: { requireBio: true } })).status, 200);
  assert.equal((await man.agent.get('/api/discover')).body.profiles.length, 0);
});
