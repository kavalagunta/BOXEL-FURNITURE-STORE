import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');

// NODE_ENV=test loads .env.test (falls back to .env) so tests never touch the real database.
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.join(SERVER_ROOT, envFile), quiet: true });
if (envFile === '.env.test') dotenv.config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

const str = (key, fallback = '') => (process.env[key] ?? fallback).toString().trim();
const bool = (key, fallback = false) => {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};
const int = (key, fallback) => {
  const n = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const nodeEnv = str('NODE_ENV', 'development');
const clientUrl = str('CLIENT_URL', 'http://localhost:5173').replace(/\/$/, '');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: int('PORT', 5000),
  clientUrl,
  apiUrl: str('API_URL', 'http://localhost:5000').replace(/\/$/, ''),
  // Extra comma-separated origins allowed by CORS (optional).
  corsOrigins: [clientUrl, ...str('CORS_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean)],

  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306),
    user: str('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: str('DB_NAME', 'boxel_store'),
  },

  session: {
    secret: str('SESSION_SECRET'),
    // Secure cookies are forced on in production when the site is served over HTTPS.
    cookieSecure: bool('SESSION_COOKIE_SECURE', false) || (nodeEnv === 'production' && clientUrl.startsWith('https://')),
    maxAgeMs: int('SESSION_MAX_AGE_HOURS', 24 * 7) * 60 * 60 * 1000,
  },

  smtp: {
    host: str('SMTP_HOST'),
    port: int('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', false),
    user: str('SMTP_USER'),
    password: process.env.SMTP_PASSWORD ?? '',
    fromName: str('SMTP_FROM_NAME', 'boxel'),
    fromEmail: str('SMTP_FROM_EMAIL'),
  },
  cloudinary: {
    cloudName: str('CLOUDINARY_CLOUD_NAME'),
    apiKey: str('CLOUDINARY_API_KEY'),
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  adminEmail: str('ADMIN_EMAIL'),

  business: {
    name: str('BUSINESS_NAME', 'boxel'),
    phone: str('BUSINESS_PHONE', '+918310018733'),
    email: str('BUSINESS_EMAIL'),
    city: str('BUSINESS_CITY'),
    state: str('BUSINESS_STATE'),
  },

  whatsapp: {
    recipientPhone: str('WHATSAPP_PHONE', '+918310018733'),
    vendorPhone: str('VENDOR_WHATSAPP_NUMBER', '+918310018733'),
    cloudApiToken: str('WHATSAPP_CLOUD_API_TOKEN'),
    cloudPhoneId: str('WHATSAPP_CLOUD_PHONE_ID'),
    twilioAccountSid: str('TWILIO_ACCOUNT_SID'),
    twilioAuthToken: str('TWILIO_AUTH_TOKEN'),
    twilioFrom: str('TWILIO_WHATSAPP_FROM'),
  },

  uploadsDir: path.join(SERVER_ROOT, 'uploads'),
  clientDist: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
  // Set TRUST_PROXY=1 when running behind a reverse proxy (nginx, a PaaS load balancer).
  trustProxy: int('TRUST_PROXY', nodeEnv === 'production' ? 1 : 0),
};

export function assertConfig() {
  const problems = [];
  if (!env.session.secret || env.session.secret.length < 32 || env.session.secret.startsWith('replace_with')) {
    if (env.isProduction) problems.push('SESSION_SECRET must be set to a random string of at least 32 characters.');
    else console.warn('[config] SESSION_SECRET is missing or weak — using an insecure development value. Set it in server/.env.');
  }
  if (problems.length) {
    for (const p of problems) console.error(`[config] ${p}`);
    process.exit(1);
  }
  if (!env.session.secret || env.session.secret.length < 32) env.session.secret = 'dev-only-insecure-secret-change-me-0123456789';
}
