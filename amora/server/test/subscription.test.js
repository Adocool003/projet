import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, signup } from './helpers.js';

test('souscription démo : exige la demande d\'exécution immédiate', async () => {
  const { app } = setup();
  const { agent } = await signup(app);
  const res = await agent.post('/api/subscription/checkout').send({ plan: 'gold' });
  assert.equal(res.status, 400);
});

test('cycle de vie complet d\'un abonnement en mode démo', async () => {
  const { app, db } = setup();
  const { agent, user } = await signup(app);

  const sub = await agent.post('/api/subscription/checkout').send({ plan: 'gold', immediateExecution: true });
  assert.equal(sub.status, 200);
  assert.equal(sub.body.activated, true);
  assert.equal(sub.body.user.subscription.plan, 'gold');
  assert.equal(sub.body.user.features.seeLikes, true);
  assert.equal((await agent.post('/api/subscription/checkout').send({ plan: 'gold', immediateExecution: true })).status, 409);

  // Passage à Platinum : effet immédiat
  const up = await agent.post('/api/subscription/checkout').send({ plan: 'platinum', immediateExecution: true });
  assert.equal(up.body.user.subscription.plan, 'platinum');

  // Résiliation : l'accès reste actif jusqu'à l'échéance
  const cancel = await agent.post('/api/subscription/cancel');
  assert.equal(cancel.body.user.subscription.cancelAtPeriodEnd, true);
  assert.equal(cancel.body.user.subscription.plan, 'platinum');
  const resume = await agent.post('/api/subscription/resume');
  assert.equal(resume.body.user.subscription.cancelAtPeriodEnd, false);

  // Échéance passée sans résiliation : renouvellement automatique
  db.prepare('UPDATE users SET plan_expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), user.id);
  const renewed = await agent.get('/api/subscription');
  assert.equal(renewed.body.subscription.plan, 'platinum');
  assert.ok(renewed.body.history.some((h) => h.type === 'renewal' && h.amountCents === 2999));

  // Échéance passée après résiliation : retour à la formule gratuite
  await agent.post('/api/subscription/cancel');
  db.prepare('UPDATE users SET plan_expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), user.id);
  const expired = await agent.get('/api/subscription');
  assert.equal(expired.body.subscription.plan, 'free');
  assert.equal(expired.body.features.dailyLikes, 30);
  assert.equal((await agent.post('/api/subscription/cancel')).status, 400);
});

test('abonnement Stripe : redirection vers Checkout puis activation par webhook', async () => {
  const calls = [];
  const fakeProvider = {
    mode: 'stripe',
    async checkout(user, plan) { calls.push(['checkout', user.id, plan]); return { url: 'https://checkout.stripe.test/s' }; },
    async cancel() {}, async resume() {}, async portal() { return { url: 'https://billing.stripe.test' }; },
    async cancelImmediately() {}, sync: (u) => u, async handleWebhook() { return { received: true }; },
  };
  const { app } = setup({ payments: fakeProvider });
  const { agent, user } = await signup(app);
  const res = await agent.post('/api/subscription/checkout').send({ plan: 'plus', immediateExecution: true });
  assert.equal(res.body.url, 'https://checkout.stripe.test/s');
  assert.deepEqual(calls, [['checkout', user.id, 'plus']]);
});

test('webhooks Stripe : activation, résiliation et fin d\'abonnement', async () => {
  const { stripeProvider } = await import('../src/services/payments.js');
  const end = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const subscription = (over = {}) => ({
    id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, current_period_end: end,
    metadata: { userId: String(userId) }, items: { data: [{ id: 'si_1', price: { id: 'price_gold' } }] }, ...over,
  });
  let pending;
  const fakeStripe = {
    webhooks: {
      constructEvent(_body, sig) {
        if (sig !== 'ok') throw new Error('bad signature');
        return pending;
      },
    },
    subscriptions: { retrieve: async () => subscription() },
  };
  const { app, db } = setup();
  const provider = stripeProvider(db, fakeStripe);
  const { agent, user } = await signup(app);
  const userId = user.id;
  const send = async (event) => { pending = event; return provider.handleWebhook(Buffer.from('{}'), 'ok'); };

  await assert.rejects(provider.handleWebhook(Buffer.from('{}'), 'ko'), { code: 'invalid_signature' });

  await send({ type: 'checkout.session.completed', data: { object: { subscription: 'sub_1' } } });
  let me = (await agent.get('/api/me')).body.user;
  assert.equal(me.subscription.plan, 'gold');
  assert.equal(me.subscription.provider, 'stripe');

  await send({ type: 'invoice.paid', data: { object: { id: 'in_1', customer: 'cus_1', amount_paid: 1999, lines: { data: [{ price: { id: 'price_gold' } }] } } } });
  const billing = db.prepare("SELECT * FROM billing_events WHERE type = 'payment'").get();
  assert.deepEqual([billing.user_id, billing.amount_cents, billing.plan], [userId, 1999, 'gold']);

  await send({ type: 'customer.subscription.updated', data: { object: subscription({ cancel_at_period_end: true }) } });
  me = (await agent.get('/api/me')).body.user;
  assert.equal(me.subscription.cancelAtPeriodEnd, true);

  await send({ type: 'customer.subscription.deleted', data: { object: subscription({ status: 'canceled' }) } });
  me = (await agent.get('/api/me')).body.user;
  assert.equal(me.subscription.plan, 'free');
});
