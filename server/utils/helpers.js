import crypto from 'node:crypto';

/** Money is handled in integer paise to avoid floating-point drift. */
export const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
export const toRupees = (paise) => Math.round(paise) / 100;

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(amount || 0));
}

export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(length = 5) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function yymmdd(date = new Date()) {
  return date.toISOString().slice(2, 10).replace(/-/g, '');
}

/** Readable unique-ish reference such as BX-261015-7KQ4M. Uniqueness is enforced by a DB key. */
export const generateOrderNumber = () => `BX-${yymmdd()}-${randomCode(5)}`;
export const generateEnquiryRef = () => `ENQ-${yymmdd()}-${randomCode(4)}`;

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Removes HTML tags and control characters from untrusted plain-text input. */
export function stripTags(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function pagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export const pageMeta = (page, limit, total) => ({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });

export function clientIp(req) {
  return (req.ip || '').replace('::ffff:', '').slice(0, 45) || null;
}

/** Escape LIKE wildcards in user search input. */
export const likeTerm = (s) => `%${String(s).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
