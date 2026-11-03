import { z } from 'zod';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { logActivity } from '../../services/activityLog.js';
import { deleteUploadedImage } from '../../services/imageService.js';
import { deleteCloudinaryAsset } from '../../services/cloudinaryService.js';
import { pagination, pageMeta, parseJson, slugify, likeTerm } from '../../utils/helpers.js';
import { text, optionalText, slug as slugField, money, imagePath, boolish } from '../../utils/validators.js';
import { HttpError, notFound, conflict } from '../../utils/httpError.js';

const variantSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  name: text(80, 1),
  color_hex: z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #FFFFFF.').nullable().optional(),
  sku: optionalText(64),
  price_adjustment: z.coerce.number().min(-9999999).max(9999999).default(0),
  stock_quantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  is_active: boolish.default(true),
});

export const productSchema = z
  .object({
    name: text(160, 2),
    slug: z.union([slugField, z.literal('')]).optional(),
    sku: z.string().trim().min(2, 'SKU is required.').max(64).regex(/^[A-Za-z0-9\-_.]+$/, 'Use letters, numbers, - _ . only.'),
    category_id: z.coerce.number().int().positive({ error: 'Choose a category.' }),
    vendor_id: z.coerce.number().int().positive().nullable().optional().transform((v) => (v ? Number(v) : null)),
    short_description: optionalText(400),
    description: optionalText(10000),
    features: z.array(text(160, 1)).max(20).default([]),
    specifications: z.array(z.object({ label: text(80, 1), value: text(200, 1) })).max(30).default([]),
    price: money,
    sale_price: z.union([money, z.literal(''), z.null()]).optional().transform((v) => (v === '' || v === undefined || v === null || v === 0 ? null : v)),
    status: z.enum(['draft', 'active', 'coming_soon', 'archived']),
    is_featured: boolish.default(false),
    sort_order: z.coerce.number().int().min(0).max(100000).default(0),
    track_stock: boolish.default(false),
    low_stock_threshold: z.coerce.number().int().min(0).max(100000).default(3),
    shipping_info: optionalText(2000),
    warranty_info: optionalText(2000),
    seo_title: optionalText(160),
    seo_description: optionalText(320),
    og_image_url: z.union([imagePath, z.null()]).optional().transform((v) => v || null),
    variants: z.array(variantSchema).min(1, 'Add at least one colour or variant.').max(30),
    images: z.array(z.object({ url: imagePath.refine((v) => v !== '', 'Missing image.'), public_id: optionalText(255), resource_type: optionalText(20), alt: optionalText(255) })).max(15).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.sale_price !== null && d.sale_price >= d.price) {
      ctx.addIssue({ code: 'custom', path: ['sale_price'], message: 'Sale price must be lower than the regular price.' });
    }
    const names = new Set();
    d.variants.forEach((v, i) => {
      const key = v.name.toLowerCase();
      if (names.has(key)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'name'], message: 'Variant names must be unique.' });
      names.add(key);
    });
  });

export async function list(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(likeTerm(req.query.q), likeTerm(req.query.q));
  }
  if (['draft', 'active', 'coming_soon', 'archived'].includes(req.query.status)) {
    where.push('p.status = ?');
    params.push(req.query.status);
  } else if (req.query.status !== 'all') {
    where.push("p.status <> 'archived'");
  }
  if (req.query.category) {
    where.push('p.category_id = ?');
    params.push(Number(req.query.category) || 0);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM products p ${w}`, params);
  const items = await query(
    `SELECT p.id, p.name, p.slug, p.sku, p.price, p.sale_price, p.status, p.is_featured, p.track_stock, p.updated_at, p.vendor_id,
            c.name AS category_name, v.name AS vendor_name,
            (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image_url,
            (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = p.id AND is_active = 1) AS stock,
            (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variant_count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN vendors v ON v.id = p.vendor_id ${w}
      ORDER BY p.sort_order, p.id LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  res.json({ items: items.map((i) => ({ ...i, stock: Number(i.stock), variant_count: Number(i.variant_count) })), meta: pageMeta(page, limit, total) });
}

export async function get(req, res) {
  const p = await queryOne(
    `SELECT p.*, v.name AS vendor_name, v.whatsapp_number AS vendor_whatsapp
     FROM products p
     LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.id = ?`,
    [req.params.id],
  );
  if (!p) throw notFound('Product not found.');
  const images = await query('SELECT id, image_url AS url, cloudinary_public_id AS public_id, alt_text AS alt FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [p.id]);
  const variants = await query('SELECT id, name, color_hex, sku, price_adjustment, stock_quantity, is_active FROM product_variants WHERE product_id = ? ORDER BY sort_order, id', [p.id]);
  const [{ orders }] = await query('SELECT COUNT(DISTINCT order_id) AS orders FROM order_items WHERE product_id = ?', [p.id]);
  res.json({
    product: {
      ...p,
      features: parseJson(p.features, []),
      specifications: parseJson(p.specifications, []),
      is_featured: Boolean(p.is_featured),
      track_stock: Boolean(p.track_stock),
      images,
      variants: variants.map((v) => ({ ...v, is_active: Boolean(v.is_active) })),
      order_count: Number(orders),
    },
  });
}

async function assertUnique(conn, { slug, sku, variants }, productId = 0) {
  const [[s]] = await conn.query('SELECT id FROM products WHERE slug = ? AND id <> ?', [slug, productId]);
  if (s) throw conflict('Another product already uses this URL slug.', { fields: { slug: 'Already in use.' } });
  const [[k]] = await conn.query('SELECT id FROM products WHERE sku = ? AND id <> ?', [sku, productId]);
  if (k) throw conflict('Another product already uses this SKU.', { fields: { sku: 'Already in use.' } });
  for (const [i, v] of variants.entries()) {
    if (!v.sku) continue;
    const [[dupe]] = await conn.query('SELECT id FROM product_variants WHERE sku = ? AND (product_id <> ? OR id <> ?)', [v.sku, productId, v.id || 0]);
    if (dupe) throw conflict(`Variant SKU ${v.sku} is already used.`, { fields: { [`variants.${i}.sku`]: 'Already in use.' } });
  }
}

function productValues(d) {
  return [
    d.category_id, d.vendor_id ?? null, d.name, d.slug, d.sku, d.short_description, d.description, JSON.stringify(d.features), JSON.stringify(d.specifications),
    d.price, d.sale_price, d.status, d.is_featured ? 1 : 0, d.sort_order, d.track_stock ? 1 : 0, d.low_stock_threshold,
    d.shipping_info, d.warranty_info, d.seo_title, d.seo_description, d.og_image_url,
  ];
}

async function saveChildren(conn, productId, d) {
  // Images: replace the ordered list.
  const [oldImages] = await conn.query('SELECT image_url, cloudinary_public_id FROM product_images WHERE product_id = ?', [productId]);
  await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
  if (d.images.length) {
      await conn.query('INSERT INTO product_images (product_id, image_url, cloudinary_public_id, alt_text, sort_order) VALUES ?', [
      d.images.map((img, i) => [productId, img.url, img.public_id || null, img.alt || d.name, i + 1]),
    ]);
  }
  const keep = new Set(d.images.map((i) => i.url));
  const removedFiles = oldImages.filter((i) => !keep.has(i.image_url)).map((i) => ({ image_url: i.image_url, public_id: i.cloudinary_public_id }));

  // Variants: update existing, insert new, delete or deactivate removed ones.
  const [existing] = await conn.query('SELECT id FROM product_variants WHERE product_id = ?', [productId]);
  const existingIds = new Set(existing.map((v) => v.id));
  const seen = new Set();
  for (const [i, v] of d.variants.entries()) {
    const values = [v.name, v.color_hex || null, v.sku, v.price_adjustment, v.stock_quantity, v.is_active ? 1 : 0, i + 1];
    if (v.id && existingIds.has(v.id)) {
      await conn.query(
        'UPDATE product_variants SET name = ?, color_hex = ?, sku = ?, price_adjustment = ?, stock_quantity = ?, is_active = ?, sort_order = ? WHERE id = ? AND product_id = ?',
        [...values, v.id, productId],
      );
      seen.add(v.id);
    } else {
      await conn.query(
        'INSERT INTO product_variants (name, color_hex, sku, price_adjustment, stock_quantity, is_active, sort_order, product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [...values, productId],
      );
    }
  }
  for (const oldId of existingIds) {
    if (seen.has(oldId)) continue;
    const [[used]] = await conn.query('SELECT 1 AS used FROM order_items WHERE variant_id = ? LIMIT 1', [oldId]);
    // Variants referenced by past orders are deactivated, never deleted.
    if (used) await conn.query('UPDATE product_variants SET is_active = 0 WHERE id = ?', [oldId]);
    else await conn.query('DELETE FROM product_variants WHERE id = ?', [oldId]);
  }
  return removedFiles;
}

async function cleanupFiles(urls) {
  for (const asset of urls) {
    const url = typeof asset === 'string' ? asset : asset.image_url;
    const inUse = await queryOne(
      `SELECT 1 AS used FROM product_images WHERE image_url = ?
       UNION SELECT 1 FROM order_items WHERE image_url = ? UNION SELECT 1 FROM products WHERE og_image_url = ? LIMIT 1`,
      [url, url, url],
    );
    if (!inUse) {
      await deleteUploadedImage(url);
      if (asset.public_id) {
        const shared = await queryOne('SELECT 1 AS used FROM product_images WHERE cloudinary_public_id = ? LIMIT 1', [asset.public_id]);
        if (shared) continue;
        await deleteCloudinaryAsset(asset.public_id, asset.resource_type || 'image');
      }
    }
  }
}

export async function create(req, res) {
  const d = { ...req.valid.body };
  d.slug = d.slug || slugify(d.name);
  const id = await withTransaction(async (conn) => {
    await assertUnique(conn, d);
    const [[cat]] = await conn.query('SELECT id FROM categories WHERE id = ?', [d.category_id]);
    if (!cat) throw new HttpError(422, 'Choose a valid category.', { fields: { category_id: 'Choose a category.' } });
    const [r] = await conn.query(
      `INSERT INTO products (category_id, vendor_id, name, slug, sku, short_description, description, features, specifications, price, sale_price,
        status, is_featured, sort_order, track_stock, low_stock_threshold, shipping_info, warranty_info, seo_title, seo_description, og_image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      productValues(d),
    );
    await saveChildren(conn, r.insertId, d);
    return r.insertId;
  });
  await logActivity(req, 'product.create', 'product', id, { name: d.name, status: d.status, price: d.price });
  res.status(201).json({ id });
}

export async function update(req, res) {
  const id = Number(req.params.id);
  const d = { ...req.valid.body };
  d.slug = d.slug || slugify(d.name);
  const before = await queryOne('SELECT name, price, sale_price, status, slug FROM products WHERE id = ?', [id]);
  if (!before) throw notFound('Product not found.');
  const removed = await withTransaction(async (conn) => {
    await assertUnique(conn, d, id);
    const [[cat]] = await conn.query('SELECT id FROM categories WHERE id = ?', [d.category_id]);
    if (!cat) throw new HttpError(422, 'Choose a valid category.', { fields: { category_id: 'Choose a category.' } });
    await conn.query(
      `UPDATE products SET category_id = ?, vendor_id = ?, name = ?, slug = ?, sku = ?, short_description = ?, description = ?, features = ?, specifications = ?,
        price = ?, sale_price = ?, status = ?, is_featured = ?, sort_order = ?, track_stock = ?, low_stock_threshold = ?, shipping_info = ?,
        warranty_info = ?, seo_title = ?, seo_description = ?, og_image_url = ? WHERE id = ?`,
      [...productValues(d), id],
    );
    return saveChildren(conn, id, d);
  });
  await cleanupFiles(removed);
  const changes = {};
  for (const k of ['name', 'price', 'sale_price', 'status', 'slug']) if (String(before[k]) !== String(d[k])) changes[k] = { from: before[k], to: d[k] };
  await logActivity(req, 'product.update', 'product', id, changes);
  res.json({ id });
}

/** Products with order history can only be archived, never deleted. */
export async function remove(req, res) {
  const id = Number(req.params.id);
  const p = await queryOne('SELECT id, name FROM products WHERE id = ?', [id]);
  if (!p) throw notFound('Product not found.');
  const used = await queryOne('SELECT 1 AS used FROM order_items WHERE product_id = ? LIMIT 1', [id]);
  if (used) throw conflict('This product appears in past orders, so it cannot be deleted. Archive it instead.', { code: 'HAS_ORDERS' });
  const images = await query('SELECT image_url, cloudinary_public_id AS public_id FROM product_images WHERE product_id = ?', [id]);
  await query('DELETE FROM products WHERE id = ?', [id]);
  await cleanupFiles(images);
  await logActivity(req, 'product.delete', 'product', id, { name: p.name });
  res.json({ ok: true });
}

export async function archive(req, res) {
  const id = Number(req.params.id);
  const p = await queryOne('SELECT id, name, status FROM products WHERE id = ?', [id]);
  if (!p) throw notFound('Product not found.');
  await query("UPDATE products SET status = 'archived', is_featured = 0 WHERE id = ?", [id]);
  await logActivity(req, 'product.archive', 'product', id, { name: p.name, from: p.status });
  res.json({ ok: true });
}
