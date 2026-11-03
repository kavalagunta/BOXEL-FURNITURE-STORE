import { z } from 'zod';
import { query, queryOne } from '../../config/db.js';
import { logActivity } from '../../services/activityLog.js';
import { pagination, pageMeta, likeTerm } from '../../utils/helpers.js';
import { notFound } from '../../utils/httpError.js';

export const customerStatusSchema = z.object({ is_active: z.boolean() });

// Password hashes are never selected.
const SUMMARY = `SELECT c.id, c.name, c.email, c.phone, c.is_active, c.created_at, c.last_login_at,
  (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
  (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = c.id AND o.status <> 'cancelled') AS order_value,
  (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at
  FROM customers c`;

const mapRow = (r) => ({ ...r, is_active: Boolean(r.is_active), order_count: Number(r.order_count), order_value: Number(r.order_value) });

export async function list(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = [];
  const params = [];
  if (req.query.q) {
    const like = likeTerm(req.query.q);
    where.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
    params.push(like, like, like);
  }
  if (req.query.status === 'active') where.push('c.is_active = 1');
  if (req.query.status === 'disabled') where.push('c.is_active = 0');
  if (req.query.has_orders === '1') where.push('EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)');
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM customers c ${w}`, params);
  const rows = await query(`${SUMMARY} ${w} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ items: rows.map(mapRow), meta: pageMeta(page, limit, total) });
}

export async function get(req, res) {
  const row = await queryOne(`${SUMMARY} WHERE c.id = ?`, [req.params.id]);
  if (!row) throw notFound('Customer not found.');
  const [orders, addresses, reviews] = await Promise.all([
    query('SELECT id, order_number, total, status, payment_status, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50', [row.id]),
    query('SELECT id, label, full_name, phone, line1, line2, city, state, pincode, is_default FROM customer_addresses WHERE customer_id = ?', [row.id]),
    query('SELECT r.id, r.rating, r.title, r.status, r.created_at, p.name AS product_name FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.customer_id = ? ORDER BY r.created_at DESC', [row.id]),
  ]);
  res.json({ customer: mapRow(row), orders, addresses, reviews });
}

export async function setStatus(req, res) {
  const id = Number(req.params.id);
  const row = await queryOne('SELECT id, email FROM customers WHERE id = ?', [id]);
  if (!row) throw notFound('Customer not found.');
  const { is_active } = req.valid.body;
  await query('UPDATE customers SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
  // A disabled customer is signed out on their next request (loadCustomer re-checks is_active).
  await logActivity(req, is_active ? 'customer.enable' : 'customer.disable', 'customer', id, { email: row.email });
  res.json({ ok: true });
}
