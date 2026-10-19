import Stripe from 'stripe';
import { config } from '../config.js';
import { effectivePlanId, PAID_PLANS, PLANS } from '../plans.js';
import { HttpError, nowIso } from './util.js';

const PERIOD_MS = 30 * 24 * 3600 * 1000;

function logBilling(db, { userId, type, plan, amountCents = 0, provider, reference = null }) {
  db.prepare(`INSERT INTO billing_events (user_id, type, plan, amount_cents, provider, reference)
              VALUES (?, ?, ?, ?, ?, ?)`).run(userId, type, plan, amountCents, provider, reference);
}

/**
 * Paiements simulés : aucun prestataire externe, idéal pour développer et
 * faire des démonstrations. Le renouvellement mensuel est appliqué à la volée.
 */
function demoProvider(db) {
  return {
    mode: 'demo',

    async checkout(user, planId) {
      const plan = PLANS[planId];
      const current = effectivePlanId(user);
      if (current === planId && !user.plan_cancel_at_period_end) throw new HttpError(409, 'already_subscribed');
      if (current !== 'free') {
        // Changement de formule : prise d'effet immédiate, même échéance.
        db.prepare('UPDATE users SET plan = ?, plan_cancel_at_period_end = 0 WHERE id = ?').run(planId, user.id);
        logBilling(db, { userId: user.id, type: 'plan_change', plan: planId, provider: 'demo' });
      } else {
        const expires = new Date(Date.now() + PERIOD_MS).toISOString();
        db.prepare(`UPDATE users SET plan = ?, plan_expires_at = ?, plan_cancel_at_period_end = 0,
                    plan_provider = 'demo' WHERE id = ?`).run(planId, expires, user.id);
        logBilling(db, { userId: user.id, type: 'payment', plan: planId, amountCents: plan.priceCents, provider: 'demo' });
      }
      return { activated: true };
    },

    async cancel(user) {
      db.prepare('UPDATE users SET plan_cancel_at_period_end = 1 WHERE id = ?').run(user.id);
      logBilling(db, { userId: user.id, type: 'cancel', plan: user.plan, provider: 'demo' });
    },

    async resume(user) {
      db.prepare('UPDATE users SET plan_cancel_at_period_end = 0 WHERE id = ?').run(user.id);
      logBilling(db, { userId: user.id, type: 'resume', plan: user.plan, provider: 'demo' });
    },

    async portal() {
      throw new HttpError(400, 'portal_unavailable');
    },

    async cancelImmediately() {},

    /** Renouvelle les abonnements démo arrivés à échéance (non résiliés). */
    sync(user) {
      if (user.plan_provider !== 'demo' || user.plan === 'free' || user.plan_cancel_at_period_end) return user;
      if (!user.plan_expires_at || new Date(user.plan_expires_at) > new Date()) return user;
      let expires = new Date(user.plan_expires_at).getTime();
      while (expires <= Date.now()) {
        expires += PERIOD_MS;
        logBilling(db, { userId: user.id, type: 'renewal', plan: user.plan, amountCents: PLANS[user.plan].priceCents, provider: 'demo' });
      }
      const iso = new Date(expires).toISOString();
      db.prepare('UPDATE users SET plan_expires_at = ? WHERE id = ?').run(iso, user.id);
      return { ...user, plan_expires_at: iso };
    },

    async handleWebhook() {
      throw new HttpError(400, 'webhook_unavailable');
    },
  };
}

/** Abonnements réels via Stripe Checkout + Billing (prélèvements récurrents en €). */
function stripeProvider(db, stripe = new Stripe(config.stripe.secretKey)) {
  const priceToPlan = Object.fromEntries(
    Object.entries(config.stripe.prices).filter(([, price]) => price).map(([plan, price]) => [price, plan]),
  );

  function periodEnd(sub) {
    const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    return end ? new Date(end * 1000).toISOString() : null;
  }

  function applySubscription(sub) {
    const userId = Number(sub.metadata?.userId) ||
      db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(sub.customer)?.id;
    if (!userId || !db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) return;
    const priceId = sub.items?.data?.[0]?.price?.id;
    const planId = priceToPlan[priceId];
    const live = ['active', 'trialing', 'past_due'].includes(sub.status);
    if (live && planId) {
      db.prepare(`UPDATE users SET plan = ?, plan_expires_at = ?, plan_cancel_at_period_end = ?,
                  plan_provider = 'stripe', stripe_subscription_id = ?, stripe_customer_id = ? WHERE id = ?`)
        .run(planId, periodEnd(sub), sub.cancel_at_period_end ? 1 : 0, sub.id, sub.customer, userId);
    } else {
      db.prepare(`UPDATE users SET plan = 'free', plan_expires_at = NULL, plan_cancel_at_period_end = 0,
                  stripe_subscription_id = NULL WHERE id = ? AND (stripe_subscription_id IS NULL OR stripe_subscription_id = ?)`)
        .run(userId, sub.id);
    }
  }

  async function ensureCustomer(user) {
    if (user.stripe_customer_id) return user.stripe_customer_id;
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user.id) },
      preferred_locales: [user.language],
    });
    db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, user.id);
    return customer.id;
  }

  return {
    mode: 'stripe',

    async checkout(user, planId) {
      const price = config.stripe.prices[planId];
      if (!price) throw new HttpError(500, 'price_not_configured');

      if (user.stripe_subscription_id && effectivePlanId(user) !== 'free') {
        // Changement de formule avec prorata sur la période en cours.
        const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        const updated = await stripe.subscriptions.update(sub.id, {
          items: [{ id: sub.items.data[0].id, price }],
          cancel_at_period_end: false,
          proration_behavior: 'create_prorations',
          metadata: { userId: String(user.id) },
        });
        applySubscription(updated);
        logBilling(db, { userId: user.id, type: 'plan_change', plan: planId, provider: 'stripe', reference: sub.id });
        return { activated: true };
      }

      const customer = await ensureCustomer(user);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        client_reference_id: String(user.id),
        line_items: [{ price, quantity: 1 }],
        subscription_data: { metadata: { userId: String(user.id), plan: planId } },
        allow_promotion_codes: true,
        automatic_tax: { enabled: config.stripe.automaticTax },
        ...(config.stripe.automaticTax ? { customer_update: { address: 'auto' } } : {}),
        locale: user.language === 'en' ? 'en' : 'fr',
        success_url: `${config.clientUrl}/abonnement?statut=succes`,
        cancel_url: `${config.clientUrl}/abonnement?statut=annule`,
      });
      return { url: session.url };
    },

    async cancel(user) {
      if (!user.stripe_subscription_id) throw new HttpError(400, 'no_subscription');
      const sub = await stripe.subscriptions.update(user.stripe_subscription_id, { cancel_at_period_end: true });
      applySubscription(sub);
      logBilling(db, { userId: user.id, type: 'cancel', plan: user.plan, provider: 'stripe', reference: sub.id });
    },

    async resume(user) {
      if (!user.stripe_subscription_id) throw new HttpError(400, 'no_subscription');
      const sub = await stripe.subscriptions.update(user.stripe_subscription_id, { cancel_at_period_end: false });
      applySubscription(sub);
      logBilling(db, { userId: user.id, type: 'resume', plan: user.plan, provider: 'stripe', reference: sub.id });
    },

    async portal(user) {
      if (!user.stripe_customer_id) throw new HttpError(400, 'no_subscription');
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${config.clientUrl}/abonnement`,
      });
      return { url: session.url };
    },

    async cancelImmediately(user) {
      if (user.stripe_subscription_id) {
        await stripe.subscriptions.cancel(user.stripe_subscription_id).catch(() => {});
      }
    },

    sync(user) {
      return user;
    },

    async handleWebhook(rawBody, signature) {
      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
      } catch {
        throw new HttpError(400, 'invalid_signature');
      }
      const obj = event.data.object;
      switch (event.type) {
        case 'checkout.session.completed':
          if (obj.subscription) applySubscription(await stripe.subscriptions.retrieve(obj.subscription));
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          applySubscription(obj);
          break;
        case 'invoice.paid': {
          const userId = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(obj.customer)?.id ?? null;
          const priceId = obj.lines?.data?.[0]?.price?.id ?? obj.lines?.data?.[0]?.pricing?.price_details?.price;
          logBilling(db, {
            userId, type: 'payment', plan: priceToPlan[priceId] ?? null,
            amountCents: obj.amount_paid, provider: 'stripe', reference: obj.id,
          });
          break;
        }
        case 'invoice.payment_failed': {
          const userId = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(obj.customer)?.id ?? null;
          logBilling(db, { userId, type: 'payment_failed', provider: 'stripe', reference: obj.id });
          break;
        }
        default:
          break;
      }
      return { received: true, at: nowIso() };
    },
  };
}

export function createPayments(db, options = {}) {
  if (options.provider) return options.provider;
  return config.paymentsMode === 'stripe' ? stripeProvider(db) : demoProvider(db);
}

export { PAID_PLANS, stripeProvider, demoProvider };
