import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

export const config = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT || 4000),
  appName: env.APP_NAME || 'Amora',
  clientUrl: env.CLIENT_URL || 'http://localhost:5173',
  // Cookie de session réservé au HTTPS en production (désactivable pour un test en HTTP)
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
  jwtSecret: env.JWT_SECRET || 'dev-secret-a-changer-absolument',
  dbFile: env.DB_FILE || path.join(root, 'data', 'amora.db'),
  uploadDir: env.UPLOAD_DIR || path.join(root, 'uploads'),
  clientDist: env.CLIENT_DIST || path.resolve(root, '..', 'client', 'dist'),
  // Fuseau de référence pour les quotas quotidiens (likes, super likes…)
  timeZone: env.APP_TIMEZONE || 'Europe/Paris',
  // Version des CGU / politique de confidentialité acceptées à l'inscription
  legalVersion: env.LEGAL_VERSION || '2026-10',
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    prices: {
      plus: env.STRIPE_PRICE_PLUS || '',
      gold: env.STRIPE_PRICE_GOLD || '',
      platinum: env.STRIPE_PRICE_PLATINUM || '',
    },
    automaticTax: env.STRIPE_AUTOMATIC_TAX === 'true',
  },
};

// Sans clé Stripe, l'application fonctionne en « mode démo » : les paiements
// sont simulés pour pouvoir tester tout le parcours d'abonnement.
config.paymentsMode = config.stripe.secretKey ? 'stripe' : 'demo';

if (config.isProd && config.jwtSecret.startsWith('dev-secret')) {
  throw new Error('JWT_SECRET doit être défini en production.');
}
