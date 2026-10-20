import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'amora-test-'));
delete process.env.STRIPE_SECRET_KEY;
process.env.STRIPE_PRICE_PLUS = 'price_plus';
process.env.STRIPE_PRICE_GOLD = 'price_gold';
process.env.STRIPE_PRICE_PLATINUM = 'price_platinum';

const { default: request } = await import('supertest');
const { openDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

export function birthdateYearsAgo(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 10);
  return d.toISOString().slice(0, 10);
}

/** Application isolée avec base en mémoire et un émetteur temps réel espion. */
export function setup(options = {}) {
  const db = openDb(':memory:');
  const events = [];
  const realtime = { emit: (userId, event, payload) => events.push({ userId, event, payload }), disconnectUser() {} };
  const app = createApp({ db, realtime, ...options });
  return { db, app, events };
}

let counter = 0;
export async function signup(app, overrides = {}) {
  counter++;
  const agent = request.agent(app);
  const body = {
    email: `user${counter}@test.fr`,
    password: 'motdepasse123',
    name: `User${counter}`,
    birthdate: birthdateYearsAgo(28),
    gender: 'homme',
    showMe: ['femme'],
    cityId: 'paris',
    acceptTerms: true,
    acceptSensitiveData: true,
    ...overrides,
  };
  const res = await agent.post('/api/auth/signup').send(body);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user, password: body.password };
}

export function setPlan(db, userId, plan) {
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  db.prepare("UPDATE users SET plan = ?, plan_expires_at = ?, plan_provider = 'demo' WHERE id = ?").run(plan, expires, userId);
}

export { request };
