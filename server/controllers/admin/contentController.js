import { z } from 'zod';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { logActivity } from '../../services/activityLog.js';
import { uploadMedia } from '../../services/cloudinaryService.js';
import { getSettings, groupSettings, updateSettingsGroup, SETTING_GROUPS } from '../../services/settingsService.js';
import { text, optionalText, linkUrl, imagePath, boolish, httpsUrl } from '../../utils/validators.js';
import { HttpError, notFound } from '../../utils/httpError.js';

// ---------------- Uploads ----------------
export async function upload(req, res) {
  const folder = String(req.query.folder || 'site');
  if (!['products', 'categories', 'banners', 'site'].includes(folder)) throw new HttpError(400, 'Unknown upload folder.');
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];
  if (!files.length) throw new HttpError(400, 'Choose an image to upload.');
  const cloudFolder = `shop/${folder}`;
  const saved = await Promise.all(files.map((file) => uploadMedia(file, cloudFolder)));
  await logActivity(req, 'upload.image', folder, null, { files: saved.map((s) => ({ url: s.url, public_id: s.public_id })) });
  res.status(201).json({ files: saved });
}

// ---------------- FAQs ----------------
export const faqSchema = z.object({
  question: text(300, 5),
  answer: text(5000, 5),
  product_id: z.union([z.coerce.number().int().positive(), z.null(), z.literal('')]).optional().transform((v) => (v ? v : null)),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  is_active: boolish.default(true),
});
export const idsSchema = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(500) });

export async function listFaqs(_req, res) {
  const items = await query('SELECT f.*, p.name AS product_name FROM faqs f LEFT JOIN products p ON p.id = f.product_id ORDER BY f.product_id IS NOT NULL, f.sort_order, f.id');
  res.json({ items: items.map((f) => ({ ...f, is_active: Boolean(f.is_active) })) });
}
export async function createFaq(req, res) {
  const d = req.valid.body;
  const r = await query('INSERT INTO faqs (question, answer, product_id, sort_order, is_active) VALUES (?, ?, ?, ?, ?)', [d.question, d.answer, d.product_id, d.sort_order, d.is_active ? 1 : 0]);
  await logActivity(req, 'faq.create', 'faq', r.insertId, { question: d.question });
  res.status(201).json({ id: r.insertId });
}
export async function updateFaq(req, res) {
  const id = Number(req.params.id);
  if (!(await queryOne('SELECT id FROM faqs WHERE id = ?', [id]))) throw notFound('FAQ not found.');
  const d = req.valid.body;
  await query('UPDATE faqs SET question = ?, answer = ?, product_id = ?, sort_order = ?, is_active = ? WHERE id = ?', [d.question, d.answer, d.product_id, d.sort_order, d.is_active ? 1 : 0, id]);
  await logActivity(req, 'faq.update', 'faq', id, { question: d.question });
  res.json({ id });
}
export async function deleteFaq(req, res) {
  const id = Number(req.params.id);
  const row = await queryOne('SELECT question FROM faqs WHERE id = ?', [id]);
  if (!row) throw notFound('FAQ not found.');
  await query('DELETE FROM faqs WHERE id = ?', [id]);
  await logActivity(req, 'faq.delete', 'faq', id, { question: row.question });
  res.json({ ok: true });
}
export async function reorderFaqs(req, res) {
  await withTransaction(async (conn) => {
    for (const [i, id] of req.valid.body.ids.entries()) await conn.query('UPDATE faqs SET sort_order = ? WHERE id = ?', [i + 1, id]);
  });
  await logActivity(req, 'faq.reorder', 'faq');
  res.json({ ok: true });
}

// ---------------- Banners ----------------
const optionalDate = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid date and time.' });
      return z.NEVER;
    }
    return d;
  });

export const bannerSchema = z
  .object({
    placement: z.enum(['hero', 'promo']),
    headline: text(200, 2),
    subheadline: optionalText(400),
    cta_text: optionalText(60),
    cta_url: linkUrl.optional().transform((v) => v || null),
    secondary_cta_text: optionalText(60),
    secondary_cta_url: linkUrl.optional().transform((v) => v || null),
    desktop_image_url: z.union([imagePath, z.null()]).optional().transform((v) => v || null),
    desktop_image_public_id: z.string().trim().max(255).nullable().optional(),
    mobile_image_url: z.union([imagePath, z.null()]).optional().transform((v) => v || null),
    mobile_image_public_id: z.string().trim().max(255).nullable().optional(),
    video_url: z.union([imagePath, z.null()]).optional().transform((v) => v || null),
    video_public_id: z.string().trim().max(255).nullable().optional(),
    image_alt: optionalText(255),
    is_active: boolish.default(true),
    sort_order: z.coerce.number().int().min(0).max(100000).default(0),
    starts_at: optionalDate,
    ends_at: optionalDate,
  })
  .superRefine((d, ctx) => {
    if (d.cta_text && !d.cta_url) ctx.addIssue({ code: 'custom', path: ['cta_url'], message: 'Add a link for the button.' });
    if (d.secondary_cta_text && !d.secondary_cta_url) ctx.addIssue({ code: 'custom', path: ['secondary_cta_url'], message: 'Add a link for the button.' });
    if (d.starts_at && d.ends_at && d.ends_at <= d.starts_at) ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'End must be after start.' });
    if (d.desktop_image_url && !d.image_alt) ctx.addIssue({ code: 'custom', path: ['image_alt'], message: 'Describe the image for screen readers.' });
  });

const bannerCols = ['placement', 'headline', 'subheadline', 'cta_text', 'cta_url', 'secondary_cta_text', 'secondary_cta_url', 'desktop_image_url', 'desktop_image_public_id', 'mobile_image_url', 'mobile_image_public_id', 'video_url', 'video_public_id', 'image_alt', 'is_active', 'sort_order', 'starts_at', 'ends_at'];
const bannerVals = (d) => bannerCols.map((c) => (c === 'is_active' ? (d[c] ? 1 : 0) : d[c] ?? null));

export async function listBanners(_req, res) {
  const items = await query('SELECT * FROM banners ORDER BY placement, sort_order, id');
  res.json({ items: items.map((b) => ({ ...b, is_active: Boolean(b.is_active) })) });
}
export async function createBanner(req, res) {
  const d = req.valid.body;
  const r = await query(`INSERT INTO banners (${bannerCols.join(', ')}) VALUES (${bannerCols.map(() => '?').join(', ')})`, bannerVals(d));
  await logActivity(req, 'banner.create', 'banner', r.insertId, { headline: d.headline, placement: d.placement });
  res.status(201).json({ id: r.insertId });
}
export async function updateBanner(req, res) {
  const id = Number(req.params.id);
  const before = await queryOne('SELECT * FROM banners WHERE id = ?', [id]);
  if (!before) throw notFound('Banner not found.');
  const d = req.valid.body;
  if (before.placement !== 'hero' && d.placement === 'hero' && !d.video_public_id && !d.video_url) {
    d.video_public_id = before.video_public_id || null;
    d.video_url = before.video_url || null;
  }
  await query(`UPDATE banners SET ${bannerCols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...bannerVals(d), id]);
  for (const [url, publicId] of [['desktop_image_url', 'desktop_image_public_id'], ['mobile_image_url', 'mobile_image_public_id'], ['video_url', 'video_public_id']]) {
    if (before[publicId] && before[publicId] !== d[publicId]) {
      const [table, urlColumn, idColumn] = url === 'video_url' ? ['banners', 'video_url', 'video_public_id'] : ['banners', url, publicId];
      const inUse = await queryOne(`SELECT 1 AS used FROM ${table} WHERE ${idColumn} = ? AND id <> ? LIMIT 1`, [before[publicId], id]);
      if (!inUse) { const { deleteCloudinaryAsset } = await import('../../services/cloudinaryService.js'); await deleteCloudinaryAsset(before[publicId], url === 'video_url' ? 'video' : 'image'); }
    }
  }
  await logActivity(req, 'banner.update', 'banner', id, { headline: d.headline, is_active: d.is_active });
  res.json({ id });
}
export async function deleteBanner(req, res) {
  const id = Number(req.params.id);
  const row = await queryOne('SELECT * FROM banners WHERE id = ?', [id]);
  if (!row) throw notFound('Banner not found.');
  const remaining = await query('SELECT desktop_image_public_id, mobile_image_public_id, video_public_id FROM banners WHERE id <> ?', [id]);
  await query('DELETE FROM banners WHERE id = ?', [id]);
  const { deleteCloudinaryAsset } = await import('../../services/cloudinaryService.js');
  const usedIds = new Set(remaining.flatMap((b) => [b.desktop_image_public_id, b.mobile_image_public_id, b.video_public_id]).filter(Boolean));
  await Promise.all([
    !usedIds.has(row.desktop_image_public_id) && deleteCloudinaryAsset(row.desktop_image_public_id),
    !usedIds.has(row.mobile_image_public_id) && deleteCloudinaryAsset(row.mobile_image_public_id),
    !usedIds.has(row.video_public_id) && deleteCloudinaryAsset(row.video_public_id, 'video'),
  ]);
  await logActivity(req, 'banner.delete', 'banner', id, { headline: row.headline });
  res.json({ ok: true });
}

// ---------------- Social links ----------------
const PLATFORM_HOSTS = {
  instagram: /^https:\/\/(www\.)?instagram\.com\//i,
  youtube: /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i,
  facebook: /^https:\/\/(www\.|m\.)?(facebook|fb)\.com\//i,
  x: /^https:\/\/(www\.)?(x|twitter)\.com\//i,
};
export const socialSchema = z.object({
  links: z.array(z.object({ platform: z.enum(['instagram', 'youtube', 'facebook', 'x']), url: httpsUrl, is_active: z.boolean() })).max(4),
});

export async function getSocial(_req, res) {
  const items = await query('SELECT platform, url, is_active FROM social_links ORDER BY sort_order');
  res.json({ items: items.map((s) => ({ ...s, url: s.url || '', is_active: Boolean(s.is_active) })) });
}
export async function updateSocial(req, res) {
  const fields = {};
  for (const [i, l] of req.valid.body.links.entries()) {
    if (l.url && !PLATFORM_HOSTS[l.platform].test(l.url)) fields[`links.${i}.url`] = `This does not look like a ${l.platform === 'x' ? 'X' : l.platform} profile link.`;
    if (l.is_active && !l.url) fields[`links.${i}.url`] = 'Add the profile link before showing it.';
  }
  if (Object.keys(fields).length) throw new HttpError(422, 'Please check the highlighted fields.', { fields });
  const order = { instagram: 1, youtube: 2, facebook: 3, x: 4 };
  for (const l of req.valid.body.links) {
    await query(
      `INSERT INTO social_links (platform, url, is_active, sort_order) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE url = VALUES(url), is_active = VALUES(is_active)`,
      [l.platform, l.url || null, l.is_active && l.url ? 1 : 0, order[l.platform]],
    );
  }
  await logActivity(req, 'social.update', 'settings', 'social', { links: req.valid.body.links });
  res.json({ ok: true });
}

// ---------------- Settings ----------------
export async function getSettingsGroup(req, res) {
  const group = req.params.group;
  if (!SETTING_GROUPS.includes(group)) throw notFound('Unknown settings group.');
  const all = await getSettings({ fresh: true });
  const meta = await query(
    `SELECT s.setting_key, s.updated_at, a.name AS updated_by FROM store_settings s LEFT JOIN admins a ON a.id = s.updated_by
      ORDER BY s.updated_at DESC LIMIT 1`,
  );
  res.json({ settings: groupSettings(all, group), lastUpdated: meta[0] || null });
}

export async function updateSettings(req, res) {
  const result = await updateSettingsGroup(req.params.group, req.body?.settings || {}, req);
  res.json({ ok: true, ...result });
}
