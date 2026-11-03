import { z } from 'zod';
import { stripTags } from './helpers.js';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

/** Plain text: trimmed, tags stripped. */
export const text = (max, min = 0) =>
  z.preprocess((v) => (typeof v === 'string' ? stripTags(v) : v), z.string().min(min, min > 0 ? 'This field is required.' : undefined).max(max, `Must be ${max} characters or fewer.`));

export const optionalText = (max) =>
  z.preprocess((v) => (v === null || v === undefined ? '' : typeof v === 'string' ? stripTags(v) : v), z.string().max(max, `Must be ${max} characters or fewer.`))
    .transform((v) => (v === '' ? null : v));

export const email = z
  .string({ error: 'Enter your email address.' })
  .trim()
  .toLowerCase()
  .max(190)
  .regex(EMAIL_RE, 'Enter a valid email address.');

/**
 * Indian mobile numbers: optional +91 / 91 / 0 prefix, spaces or dashes allowed,
 * then 10 digits starting with 6–9. Normalised to +91XXXXXXXXXX.
 */
export function normalizeIndianMobile(value) {
  const digits = String(value || '').replace(/[\s\-().]/g, '');
  const m = digits.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return m ? `+91${m[1]}` : null;
}

export const indianMobile = z
  .string({ error: 'Enter your mobile number.' })
  .trim()
  .transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number.' });
      return z.NEVER;
    }
    return n;
  });

export const optionalPhone = z
  .preprocess((v) => (v === null || v === undefined ? '' : String(v).trim()), z.string())
  .transform((v, ctx) => {
    if (v === '') return null;
    const n = normalizeIndianMobile(v);
    if (n) return n;
    // Accept international numbers in a loose E.164-like format for enquiries.
    const intl = v.replace(/[\s\-().]/g, '');
    if (/^\+?\d{8,15}$/.test(intl)) return intl;
    ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number.' });
    return z.NEVER;
  });

export const pincode = z
  .string({ error: 'Enter your PIN code.' })
  .transform((v) => v.replace(/\s/g, ''))
  .pipe(z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code.'));

export const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Use 128 characters or fewer.')
  .regex(/[a-zA-Z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

export const id = z.coerce.number().int().positive();

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only.');

/** Relative site path (/products/x) or absolute http(s) URL. */
export const linkUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^\/(?!\/)[^\s]*$/.test(v) || /^https?:\/\/[^\s]+$/i.test(v), 'Use a site path like /products or a full https:// URL.');

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/i.test(v), 'Use a full https:// URL.');

/** Image path: an uploaded file, a bundled public image, or empty. */
export const imagePath = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^\/(uploads|images)\/[\w\-./]+$/.test(v) || /^https:\/\/[^\s]+$/i.test(v), 'Invalid image path.');

export const money = z.coerce.number().min(0, 'Must be zero or more.').max(99999999, 'Amount is too large.').transform((n) => Math.round(n * 100) / 100);

export const boolish = z.preprocess((v) => v === true || v === 1 || v === '1' || v === 'true', z.boolean());
