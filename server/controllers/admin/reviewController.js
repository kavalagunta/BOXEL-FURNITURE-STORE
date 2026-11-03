import { z } from 'zod';
import { query, queryOne } from '../../config/db.js';
import { logActivity } from '../../services/activityLog.js';
import { pagination, pageMeta } from '../../utils/helpers.js';
import { notFound } from '../../utils/httpError.js';

export const moderateSchema = z.object({ status: z.enum(['approved', 'rejected', 'pending']) });

export async function list(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = [];
  const params = [];
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) {
    where.push('r.status = ?');
    params.push(req.query.status);
  }
  if (/^[1-5]$/.test(req.query.rating || '')) {
    where.push('r.rating = ?');
    params.push(Number(req.query.rating));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM reviews r ${w}`, params);
  const items = await query(
    `SELECT r.id, r.rating, r.title, r.body, r.display_name, r.is_verified_purchase, r.status, r.created_at, r.moderated_at,
            p.name AS product_name, p.slug AS product_slug, c.email AS customer_email, a.name AS moderated_by
       FROM reviews r JOIN products p ON p.id = r.product_id
       LEFT JOIN customers c ON c.id = r.customer_id LEFT JOIN admins a ON a.id = r.moderated_by
       ${w} ORDER BY r.status = 'pending' DESC, r.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  res.json({ items, meta: pageMeta(page, limit, total) });
}

export async function moderate(req, res) {
  const id = Number(req.params.id);
  const review = await queryOne('SELECT id, status FROM reviews WHERE id = ?', [id]);
  if (!review) throw notFound('Review not found.');
  const { status } = req.valid.body;
  await query('UPDATE reviews SET status = ?, moderated_by = ?, moderated_at = UTC_TIMESTAMP() WHERE id = ?', [status, req.admin.id, id]);
  await logActivity(req, 'review.moderate', 'review', id, { from: review.status, to: status });
  res.json({ ok: true });
}

export async function remove(req, res) {
  const id = Number(req.params.id);
  const review = await queryOne('SELECT id, title FROM reviews WHERE id = ?', [id]);
  if (!review) throw notFound('Review not found.');
  await query('DELETE FROM reviews WHERE id = ?', [id]);
  await logActivity(req, 'review.delete', 'review', id, { title: review.title });
  res.json({ ok: true });
}
