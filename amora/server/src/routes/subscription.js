import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { effectivePlanId, PAID_PLANS } from '../plans.js';
import { getUser, ownProfile } from '../services/profiles.js';
import { HttpError } from '../services/util.js';
import { ah, validate } from '../services/validate.js';

const checkoutSchema = z.object({
  plan: z.enum(PAID_PLANS),
  // Droit de rétractation (art. L221-18 et L221-25 C. conso.) : le membre
  // demande expressément l'exécution immédiate du service avant la fin du
  // délai de 14 jours et reconnaît qu'il devra, s'il se rétracte, payer le
  // service déjà fourni au prorata.
  immediateExecution: z.literal(true),
});

export function subscriptionRoutes({ db, payments }) {
  const router = Router();

  const history = (userId) => db.prepare(`
    SELECT type, plan, amount_cents AS amountCents, currency, provider, created_at AS createdAt
    FROM billing_events WHERE user_id = ? ORDER BY id DESC LIMIT 50
  `).all(userId);

  router.get('/', (req, res) => {
    const profile = ownProfile(db, req.user);
    res.json({ subscription: profile.subscription, features: profile.features, mode: payments.mode, history: history(req.user.id) });
  });

  router.post('/checkout', ah(async (req, res) => {
    const { plan } = validate(checkoutSchema, req.body);
    db.prepare('INSERT INTO consents (user_id, type, version, granted) VALUES (?, ?, ?, 1)')
      .run(req.user.id, 'immediate_execution', config.legalVersion);
    const result = await payments.checkout(req.user, plan);
    res.json({ ...result, user: ownProfile(db, getUser(db, req.user.id)) });
  }));

  // Bouton « Résilier mon abonnement » (résiliation en 3 clics, art. L215-1-1
  // C. conso.) : l'accès est conservé jusqu'à la fin de la période payée.
  router.post('/cancel', ah(async (req, res) => {
    if (effectivePlanId(req.user) === 'free') throw new HttpError(400, 'no_subscription');
    await payments.cancel(req.user);
    res.json({ user: ownProfile(db, getUser(db, req.user.id)) });
  }));

  router.post('/resume', ah(async (req, res) => {
    if (effectivePlanId(req.user) === 'free' || !req.user.plan_cancel_at_period_end) throw new HttpError(400, 'no_subscription');
    await payments.resume(req.user);
    res.json({ user: ownProfile(db, getUser(db, req.user.id)) });
  }));

  router.post('/portal', ah(async (req, res) => {
    res.json(await payments.portal(req.user));
  }));

  return router;
}
