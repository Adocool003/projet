import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, setPlan, setup, signup } from './helpers.js';

async function matched(app) {
  const man = await signup(app, { gender: 'homme', showMe: ['femme'] });
  const woman = await signup(app, { gender: 'femme', showMe: ['homme'] });
  await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'like' });
  const res = await woman.agent.post('/api/swipes').send({ targetId: man.user.id, action: 'like' });
  return { man, woman, matchId: res.body.match.id };
}

test('messagerie entre membres matchés, avec accusés de lecture Gold', async () => {
  const { app, db, events } = setup();
  const { man, woman, matchId } = await matched(app);
  const sent = await man.agent.post(`/api/matches/${matchId}/messages`).send({ body: '  Bonjour 👋  ' });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.message.body, 'Bonjour 👋');
  assert.ok(events.some((e) => e.userId === woman.user.id && e.event === 'message:new'));

  const list = await woman.agent.get('/api/matches');
  assert.equal(list.body.matches[0].unread, 1);
  await woman.agent.post(`/api/matches/${matchId}/read`);
  assert.equal((await woman.agent.get('/api/matches')).body.matches[0].unread, 0);

  let mine = (await man.agent.get(`/api/matches/${matchId}/messages`)).body.messages[0];
  assert.equal(mine.readAt, undefined);
  setPlan(db, man.user.id, 'gold');
  mine = (await man.agent.get(`/api/matches/${matchId}/messages`)).body.messages[0];
  assert.ok(mine.readAt);
});

test('impossible d\'écrire dans une conversation dont on ne fait pas partie', async () => {
  const { app } = setup();
  const { matchId } = await matched(app);
  const intruder = await signup(app);
  assert.equal((await intruder.agent.post(`/api/matches/${matchId}/messages`).send({ body: 'hey' })).status, 404);
  assert.equal((await intruder.agent.get(`/api/matches/${matchId}/messages`)).status, 404);
});

test('bloquer supprime le match et masque le profil', async () => {
  const { app } = setup();
  const { man, woman, matchId } = await matched(app);
  assert.equal((await woman.agent.post('/api/blocks').send({ userId: man.user.id })).status, 201);
  assert.equal((await man.agent.get(`/api/matches/${matchId}`)).status, 404);
  assert.equal((await man.agent.post('/api/swipes').send({ targetId: woman.user.id, action: 'like' })).status, 404);
  assert.equal((await woman.agent.get('/api/blocks')).body.blocks[0].userId, man.user.id);
});

test('signalement puis bannissement par un administrateur', async () => {
  const { app, db } = setup();
  const { man, woman } = await matched(app);
  assert.equal((await woman.agent.post('/api/reports').send({ userId: man.user.id, reason: 'harassment', details: 'messages insistants' })).status, 201);
  assert.equal((await woman.agent.get('/api/admin/reports')).status, 403);

  const admin = await signup(app);
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(admin.user.id);
  const reports = await admin.agent.get('/api/admin/reports');
  assert.equal(reports.body.reports.length, 1);
  assert.equal(reports.body.reports[0].reported.id, man.user.id);
  assert.equal((await admin.agent.post(`/api/admin/users/${man.user.id}/ban`).send({ banned: true })).status, 200);
  assert.equal((await man.agent.get('/api/discover')).status, 403);
  const stats = await admin.agent.get('/api/admin/stats');
  assert.equal(stats.status, 200);
  assert.equal(stats.body.openReports, 0);
});

test('RGPD : export des données puis suppression du compte', async () => {
  const { app, db } = setup();
  const { man, woman, matchId } = await matched(app);
  await man.agent.post(`/api/matches/${matchId}/messages`).send({ body: 'Coucou' });
  await man.agent.post('/api/subscription/checkout').send({ plan: 'plus', immediateExecution: true });

  const exp = await man.agent.get('/api/me/export');
  assert.equal(exp.status, 200);
  assert.equal(exp.body.account.email, man.user.email);
  assert.equal(exp.body.account.password_hash, undefined);
  assert.equal(exp.body.messagesSent.length, 1);
  assert.ok(exp.body.consents.length >= 3);

  assert.equal((await man.agent.delete('/api/me').send({ password: 'faux' })).status, 401);
  assert.equal((await man.agent.delete('/api/me').send({ password: man.password })).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').get(man.user.id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 0);
  assert.equal((await woman.agent.get('/api/matches')).body.matches.length, 0);
  // Les écritures comptables sont conservées mais anonymisées
  const billing = db.prepare('SELECT * FROM billing_events').all();
  assert.ok(billing.length > 0 && billing.every((b) => b.user_id === null));
  assert.equal((await request(app).post('/api/auth/login').send({ email: man.user.email, password: man.password })).status, 401);
});

test('upload de photo : seules les vraies images sont acceptées', async () => {
  const { app } = setup();
  const { agent } = await signup(app);
  const fake = await agent.post('/api/me/photos').attach('photo', Buffer.from('<script>alert(1)</script>'), { filename: 'x.jpg', contentType: 'image/jpeg' });
  assert.equal(fake.status, 400);
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  const ok = await agent.post('/api/me/photos').attach('photo', png, { filename: 'p.png', contentType: 'image/png' });
  assert.equal(ok.status, 201);
  assert.match(ok.body.photos[0].url, /^\/uploads\/[a-f0-9]{32}\.png$/);
  const del = await agent.delete(`/api/me/photos/${ok.body.photos[0].id}`);
  assert.equal(del.body.photos.length, 0);
});

test('les comptes inactifs depuis plus de 2 ans sont supprimés', async () => {
  const { purgeInactiveAccounts } = await import('../src/services/retention.js');
  const { app, db } = setup();
  const old = await signup(app);
  const recent = await signup(app);
  db.prepare("UPDATE users SET last_active = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(old.user.id);
  assert.equal(purgeInactiveAccounts(db), 1);
  assert.ok(!db.prepare('SELECT 1 FROM users WHERE id = ?').get(old.user.id));
  assert.ok(db.prepare('SELECT 1 FROM users WHERE id = ?').get(recent.user.id));
});
