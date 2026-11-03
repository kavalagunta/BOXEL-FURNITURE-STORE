import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { listPublicProducts, getPublicProduct, relatedProducts } from '../services/catalogService.js';
import { pagination, pageMeta } from '../utils/helpers.js';
import { text } from '../utils/validators.js';
import { HttpError, notFound } from '../utils/httpError.js';

export async function categories(_req, res) {
  const rows = await query(
    `SELECT c.id, c.name, c.slug, c.description, c.image_url, c.status, c.seo_title, c.seo_description,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') AS product_count
       FROM categories c WHERE c.status IN ('active','coming_soon') ORDER BY c.sort_order, c.id`,
  );
  res.json({ items: rows.map((r) => ({ ...r, product_count: Number(r.product_count) })) });
}

export const productListQuery = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.string().trim().max(140).optional(),
  availability: z.enum(['all', 'available', 'coming_soon']).optional().default('all'),
  sort: z.enum(['featured', 'newest', 'price_asc', 'price_desc', 'name']).optional().default('featured'),
  featured: z.enum(['1', 'true']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

export async function products(req, res) {
  const q = req.valid.query;
  const { page, limit, offset } = pagination(q, { defaultLimit: 12, maxLimit: 48 });
  const { items, total } = await listPublicProducts({ ...q, featured: Boolean(q.featured), page, limit, offset });
  res.json({ items, meta: pageMeta(page, limit, total) });
}

export async function product(req, res) {
  const p = await getPublicProduct(String(req.params.slug).slice(0, 180));
  if (!p) throw notFound('This product does not exist or is no longer available.');
  const related = await relatedProducts(p, 4);
  const { _categoryId, ...data } = p;
  res.json({ product: data, related });
}

export async function reviews(req, res) {
  const product = await queryOne("SELECT id FROM products WHERE slug = ? AND status IN ('active','coming_soon')", [req.params.slug]);
  if (!product) throw notFound('Product not found.');
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 6, maxLimit: 20 });
  const [{ total }] = await query("SELECT COUNT(*) AS total FROM reviews WHERE product_id = ? AND status = 'approved'", [product.id]);
  const items = await query(
    `SELECT id, rating, title, body, display_name, is_verified_purchase, created_at FROM reviews
      WHERE product_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [product.id, limit, offset],
  );
  res.json({ items, meta: pageMeta(page, limit, total) });
}

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
  title: text(150, 2),
  body: text(3000, 10),
  displayName: text(80, 2),
});

/** Reviews require a signed-in customer and always start as "pending" moderation. */
export async function submitReview(req, res) {
  const product = await queryOne("SELECT id FROM products WHERE slug = ? AND status = 'active'", [req.params.slug]);
  if (!product) throw notFound('Product not found.');
  const d = req.valid.body;
  const existing = await queryOne('SELECT id FROM reviews WHERE product_id = ? AND customer_id = ?', [product.id, req.customer.id]);
  if (existing) throw new HttpError(409, 'You have already reviewed this product.');
  // Verified purchase is derived from real order records, never from user input.
  const purchase = await queryOne(
    `SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = ? AND oi.product_id = ? AND o.status = 'delivered' LIMIT 1`,
    [req.customer.id, product.id],
  );
  await query(
    'INSERT INTO reviews (product_id, customer_id, rating, title, body, display_name, is_verified_purchase, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [product.id, req.customer.id, d.rating, d.title, d.body, d.displayName, purchase ? 1 : 0, 'pending'],
  );
  res.status(201).json({ message: 'Thank you. Your review will appear once it has been approved.' });
}
