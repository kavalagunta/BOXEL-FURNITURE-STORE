import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { normalizeIndianMobile } from '../utils/validators.js';
import { stripTags } from '../utils/helpers.js';
import { HttpError } from '../utils/httpError.js';
import { logActivity } from './activityLog.js';

/**
 * Every editable setting, the admin page (group) it belongs to and how it is validated.
 * `private: true` settings are never sent to the public site.
 */
export const SETTINGS_DEF = {
  // Store / brand / homepage / SEO / legal / payments / tax
  business_name: { group: 'store', type: 'text', max: 80, required: true },
  business_tagline: { group: 'store', type: 'text', max: 120 },
  business_supporting_line: { group: 'store', type: 'text', max: 160 },
  business_description: { group: 'store', type: 'longtext', max: 600 },
  logo_url: { group: 'store', type: 'image' },
  announcement_enabled: { group: 'store', type: 'bool' },
  announcement_text: { group: 'store', type: 'text', max: 160 },
  announcement_link: { group: 'store', type: 'link' },
  home_intro_heading: { group: 'store', type: 'text', max: 120 },
  home_intro_body: { group: 'store', type: 'longtext', max: 800 },
  home_quality_note: { group: 'store', type: 'longtext', max: 400 },
  seo_default_title: { group: 'store', type: 'text', max: 70 },
  seo_default_description: { group: 'store', type: 'text', max: 170 },
  seo_og_image: { group: 'store', type: 'image' },
  privacy_policy: { group: 'store', type: 'longtext', max: 20000 },
  terms_content: { group: 'store', type: 'longtext', max: 20000 },
  cod_enabled: { group: 'store', type: 'bool' },
  bank_transfer_enabled: { group: 'store', type: 'bool' },
  bank_transfer_instructions: { group: 'store', type: 'longtext', max: 1000 },
  tax_enabled: { group: 'store', type: 'bool' },
  tax_label: { group: 'store', type: 'text', max: 30 },
  tax_rate: { group: 'store', type: 'percent' },
  prices_include_tax: { group: 'store', type: 'bool' },
  newsletter_enabled: { group: 'store', type: 'bool' },
  // Typography — applied site-wide through CSS variables (client/src/utils/typography.js).
  typography_font: { group: 'store', type: 'enum', options: ['albert-sans', 'inter', 'manrope', 'plus-jakarta-sans', 'dm-sans'] },
  typography_base_size: { group: 'store', type: 'int', min: 14, max: 20 },
  typography_heading_weight: { group: 'store', type: 'int', min: 300, max: 700 },
  typography_body_weight: { group: 'store', type: 'int', min: 350, max: 600 },

  // Business contact details & location
  business_phone: { group: 'contact', type: 'phone', required: true },
  business_whatsapp: { group: 'contact', type: 'phone' },
  business_email: { group: 'contact', type: 'email' },
  business_city: { group: 'contact', type: 'text', max: 80 },
  business_state: { group: 'contact', type: 'text', max: 80 },
  business_address: { group: 'contact', type: 'longtext', max: 400 },
  business_hours: { group: 'contact', type: 'text', max: 160 },
  store_name: { group: 'contact', type: 'text', max: 120 },
  location_mode: { group: 'contact', type: 'enum', options: ['store', 'service_area'] },
  service_area_text: { group: 'contact', type: 'text', max: 240 },
  map_url: { group: 'contact', type: 'https' },
  map_embed_url: { group: 'contact', type: 'mapEmbed' },

  // Shipping & policies
  shipping_fee: { group: 'shipping', type: 'money' },
  free_shipping_threshold: { group: 'shipping', type: 'money' },
  shipping_policy: { group: 'shipping', type: 'longtext', max: 20000 },
  returns_policy: { group: 'shipping', type: 'longtext', max: 20000 },
  warranty_policy: { group: 'shipping', type: 'longtext', max: 20000 },

  // Email notifications (private)
  email_notify_customer_orders: { group: 'email', type: 'bool', private: true },
  email_notify_admin_orders: { group: 'email', type: 'bool', private: true },
  email_notify_enquiries: { group: 'email', type: 'bool', private: true },
  email_contact_ack: { group: 'email', type: 'bool', private: true },
  email_notify_newsletter: { group: 'email', type: 'bool', private: true },
  admin_notification_email: { group: 'email', type: 'email', private: true },
};

export const SETTING_GROUPS = ['store', 'contact', 'shipping', 'email'];

let cache = null;
let cacheAt = 0;
const TTL_MS = 30_000;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < TTL_MS) return cache;
  const rows = await query('SELECT setting_key, setting_value FROM store_settings');
  const map = {};
  for (const r of rows) map[r.setting_key] = r.setting_value ?? '';
  // Environment values act as defaults when a setting has never been filled in.
  map.business_name ||= env.business.name;
  map.business_phone ||= env.business.phone;
  map.business_email ||= env.business.email;
  map.business_city ||= env.business.city;
  map.business_state ||= env.business.state;
  cache = map;
  cacheAt = Date.now();
  return map;
}

export function invalidateSettings() {
  cache = null;
}

export const flag = (settings, key) => settings[key] === '1' || settings[key] === 'true';
export const num = (settings, key) => {
  const n = Number(settings[key]);
  return Number.isFinite(n) ? n : 0;
};

export function publicSettings(all) {
  const out = {};
  for (const [key, value] of Object.entries(all)) {
    const def = SETTINGS_DEF[key];
    if (def?.private) continue;
    if (!def) continue;
    if (def.type === 'bool') out[key] = value === '1';
    else if (def.type === 'money' || def.type === 'percent' || def.type === 'int') out[key] = Number(value) || 0;
    else out[key] = value ?? '';
  }
  return out;
}

export function groupSettings(all, group) {
  const out = {};
  for (const [key, def] of Object.entries(SETTINGS_DEF)) {
    if (def.group !== group) continue;
    const value = all[key] ?? '';
    out[key] = def.type === 'bool' ? value === '1' : value;
  }
  return out;
}

function coerce(key, def, raw, errors) {
  const v = raw === null || raw === undefined ? '' : raw;
  const s = typeof v === 'string' ? v.trim() : v;
  const fail = (msg) => { errors[key] = msg; return null; };
  switch (def.type) {
    case 'bool':
      return s === true || s === '1' || s === 1 || s === 'true' ? '1' : '0';
    case 'money': {
      const n = Number(s === '' ? 0 : s);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return fail('Enter an amount of zero or more.');
      return (Math.round(n * 100) / 100).toString();
    }
    case 'percent': {
      const n = Number(s === '' ? 0 : s);
      if (!Number.isFinite(n) || n < 0 || n > 100) return fail('Enter a percentage between 0 and 100.');
      return n.toString();
    }
    case 'enum':
      if (!def.options.includes(s)) return fail('Choose a valid option.');
      return s;
    case 'int': {
      const n = Number(s);
      if (!Number.isInteger(n) || n < def.min || n > def.max) return fail(`Enter a whole number from ${def.min} to ${def.max}.`);
      return String(n);
    }
    case 'phone': {
      if (s === '') return def.required ? fail('This field is required.') : '';
      const n = normalizeIndianMobile(s) || (/^\+\d{8,15}$/.test(String(s).replace(/[\s-]/g, '')) ? String(s).replace(/[\s-]/g, '') : null);
      return n || fail('Enter a valid phone number, e.g. +91 83100 18733.');
    }
    case 'email':
      if (s === '') return '';
      return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s) ? String(s).toLowerCase() : fail('Enter a valid email address.');
    case 'https':
      if (s === '') return '';
      return /^https:\/\/[^\s]+$/i.test(s) && s.length <= 500 ? s : fail('Use a full https:// link.');
    case 'mapEmbed':
      if (s === '') return '';
      return /^https:\/\/(www\.)?google\.com\/maps\/embed\?[^\s"'<>]+$/i.test(s) && s.length <= 1500
        ? s
        : fail('Paste the src link from Google Maps → Share → Embed a map (starts with https://www.google.com/maps/embed?).');
    case 'link':
      if (s === '') return '';
      return /^\/(?!\/)[^\s]*$/.test(s) || /^https:\/\/[^\s]+$/i.test(s) ? s : fail('Use a site path like /products or a full https:// link.');
    case 'image':
      if (s === '') return '';
      return /^\/(uploads|images)\/[\w\-./]+$/.test(s) ? s : fail('Upload an image or use a path under /images or /uploads.');
    case 'longtext':
    case 'text': {
      const clean = stripTags(String(s));
      if (def.required && !clean) return fail('This field is required.');
      if (clean.length > def.max) return fail(`Must be ${def.max} characters or fewer.`);
      return def.type === 'text' ? clean.replace(/\s+/g, ' ') : clean;
    }
    default:
      return fail('Unknown setting.');
  }
}

/** Validates and saves the settings of one group; logs exactly which keys changed. */
export async function updateSettingsGroup(group, input, req) {
  if (!SETTING_GROUPS.includes(group)) throw new HttpError(404, 'Unknown settings group.');
  const errors = {};
  const updates = {};
  for (const [key, raw] of Object.entries(input || {})) {
    const def = SETTINGS_DEF[key];
    if (!def || def.group !== group) continue;
    const value = coerce(key, def, raw, errors);
    if (value !== null) updates[key] = value;
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Please check the highlighted fields.', { fields: errors });

  const before = await getSettings({ fresh: true });
  const changed = {};
  for (const [key, value] of Object.entries(updates)) {
    if ((before[key] ?? '') === value) continue;
    await query(
      `INSERT INTO store_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, value, req.admin.id],
    );
    const short = (x) => (String(x ?? '').length > 120 ? `${String(x).slice(0, 117)}…` : x);
    changed[key] = { from: short(before[key] ?? ''), to: short(value) };
  }
  invalidateSettings();
  if (Object.keys(changed).length) await logActivity(req, 'settings.update', 'settings', group, { changed });
  return { changed: Object.keys(changed) };
}
