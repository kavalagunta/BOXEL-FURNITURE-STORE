import crypto from 'node:crypto';
import { HttpError } from '../utils/httpError.js';

/**
 * CSRF protection for cookie sessions (synchronizer token pattern):
 * the token lives in the server-side session and must be echoed in the
 * X-CSRF-Token header on every state-changing request. Cookies are also
 * SameSite=Lax, which blocks most cross-site POSTs on its own.
 */
export function ensureCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  const sent = req.get('x-csrf-token') || '';
  const expected = req.session?.csrfToken || '';
  const ok =
    sent.length > 0 &&
    sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!ok) return next(new HttpError(403, 'Your session expired. Refresh the page and try again.', { code: 'CSRF' }));
  next();
}
