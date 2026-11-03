import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { loadCustomer } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimits.js';
import { errorHandler, notFoundApi } from './middleware/errorHandler.js';
import { csrf, sitemap, robots } from './controllers/siteController.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { headFor } from './services/seoService.js';

export function createApp({ sessionStore } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'"],
          // Framer Motion animates via inline style attributes.
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-src': ['https://www.google.com'],
          'upgrade-insecure-requests': env.session.cookieSecure ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '300kb' }));

  const MySQLStore = MySQLStoreFactory(session);
  app.use(
    session({
      name: 'boxel.sid',
      secret: env.session.secret,
      store: sessionStore ?? new MySQLStore({ createDatabaseTable: false, clearExpired: true, checkExpirationInterval: 15 * 60 * 1000 }, pool),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.session.cookieSecure,
        maxAge: env.session.maxAgeMs,
      },
    }),
  );

  // Uploaded images: served as static files, never executed or sniffed.
  app.use(
    '/uploads',
    express.static(env.uploadsDir, {
      maxAge: '30d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
    }),
  );

  app.get('/sitemap.xml', sitemap);
  app.get('/robots.txt', robots);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(apiLimiter);
  api.use(loadCustomer);
  api.get('/csrf', csrf);
  api.use(csrfProtection);
  api.use('/admin', adminRoutes);
  api.use(publicRoutes);
  api.use(notFoundApi);
  app.use('/api', api);

  // Production: serve the built React app with server-rendered <head> metadata
  // and an SPA fallback so every client route works on refresh.
  const indexFile = path.join(env.clientDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    const template = fs.readFileSync(indexFile, 'utf8');
    app.use(express.static(env.clientDist, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable'); } }));
    app.get('/{*splat}', async (req, res, next) => {
      try {
        const { head, status } = await headFor(req.path);
        res.status(status).set('Cache-Control', 'no-cache').type('html').send(template.replace('<!--app-head-->', head));
      } catch (err) {
        next(err);
      }
    });
  }

  app.use(errorHandler);
  return app;
}
