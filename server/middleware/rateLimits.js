import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

function limiter({ windowMinutes, limit, message }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (_req, res) => res.status(429).json({ error: message }),
  });
}

export const apiLimiter = limiter({ windowMinutes: 15, limit: 1500, message: 'Too many requests. Please wait a moment and try again.' });
export const loginLimiter = limiter({ windowMinutes: 15, limit: 10, message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
export const registerLimiter = limiter({ windowMinutes: 60, limit: 10, message: 'Too many accounts created from this connection. Try again later.' });
export const passwordResetLimiter = limiter({ windowMinutes: 60, limit: 5, message: 'Too many reset requests. Try again later.' });
export const contactLimiter = limiter({ windowMinutes: 60, limit: 8, message: 'Too many messages sent. Please try again later or call us.' });
export const reviewLimiter = limiter({ windowMinutes: 60, limit: 6, message: 'Too many reviews submitted. Try again later.' });
export const checkoutLimiter = limiter({ windowMinutes: 15, limit: 15, message: 'Too many checkout attempts. Please wait a few minutes.' });
export const newsletterLimiter = limiter({ windowMinutes: 60, limit: 10, message: 'Too many sign-up attempts. Try again later.' });
