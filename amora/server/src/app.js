import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import multer from 'multer';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { CITIES } from './data/cities.js';
import { publicPlans } from './plans.js';
import { nullRealtime } from './realtime.js';
import { createPayments } from './services/payments.js';
import { INTERESTS, GENDERS } from './services/profiles.js';
import { HttpError } from './services/util.js';
import { ah } from './services/validate.js';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { discoverRoutes } from './routes/discover.js';
import { matchesRoutes } from './routes/matches.js';
import { REPORT_REASONS, safetyRoutes } from './routes/safety.js';
import { subscriptionRoutes } from './routes/subscription.js';
import { adminRoutes } from './routes/admin.js';

/**
 * Construit l'application Express. `realtime` et `payments` sont injectables
 * pour les tests ; par défaut on utilise Stripe si une clé est configurée,
 * sinon le mode démo.
 */
export function createApp({ db, realtime = nullRealtime(), payments = createPayments(db) }) {
  const app = express();
  const ctx = { db, realtime, payments };
  app.locals.payments = payments;
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", 'ws:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Le webhook Stripe a besoin du corps brut pour vérifier la signature.
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), ah(async (req, res) => {
    res.json(await payments.handleWebhook(req.body, req.headers['stripe-signature']));
  }));

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/meta', (_req, res) => {
    res.json({
      appName: config.appName,
      paymentsMode: payments.mode,
      plans: publicPlans(),
      cities: CITIES.map(({ id, name, country }) => ({ id, name, country })),
      interests: INTERESTS,
      genders: GENDERS,
      reportReasons: REPORT_REASONS,
      legalVersion: config.legalVersion,
    });
  });

  app.use('/api/auth', authRoutes(ctx));

  const auth = requireAuth(db);
  // Renouvellement à la volée des abonnements simulés (mode démo).
  const sync = (req, _res, next) => {
    req.user = payments.sync(req.user);
    next();
  };
  app.use('/api/me', auth, sync, profileRoutes(ctx));
  app.use('/api/matches', auth, sync, matchesRoutes(ctx));
  app.use('/api/subscription', auth, sync, subscriptionRoutes(ctx));
  app.use('/api/admin', auth, adminRoutes(ctx));
  app.use('/api', auth, sync, discoverRoutes(ctx), safetyRoutes(ctx));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found')));

  // Photos des membres : noms aléatoires, servies sans indexation.
  app.use('/uploads', express.static(config.uploadDir, {
    maxAge: '7d',
    setHeaders: (res) => res.setHeader('X-Robots-Tag', 'noindex'),
  }));

  // En production, le serveur sert aussi l'application React compilée.
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, ...err.extra });
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'invalid_upload' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (!config.isTest) console.error(err);
    res.status(500).json({ error: 'server_error' });
  });

  return app;
}
