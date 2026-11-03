import { z } from 'zod';
import { query, queryOne, withTransaction } from '../config/db.js';
import { getOrderDetail } from '../services/orderService.js';
import { pagination, pageMeta } from '../utils/helpers.js';
import { text, optionalText, indianMobile, pincode } from '../utils/validators.js';
import { INDIAN_STATES } from '../utils/indianStates.js';
import { HttpError, notFound } from '../utils/httpError.js';

/** Customers only ever see orders linked to their own account ID. */
export async function orders(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 10, maxLimit: 50 });
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM orders WHERE customer_id = ?', [req.customer.id]);
  const items = await query(
    `SELECT o.order_number, o.status, o.payment_status, o.payment_method, o.total, o.created_at,
            (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT image_url FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image_url
       FROM orders o WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [req.customer.id, limit, offset],
  );
  res.json({ items: items.map((i) => ({ ...i, item_count: Number(i.item_count) })), meta: pageMeta(page, limit, total) });
}

export async function order(req, res) {
  const detail = await getOrderDetail('order_number = ? AND customer_id = ?', [String(req.params.orderNumber).slice(0, 24), req.customer.id]);
  if (!detail) throw notFound('Order not found.');
  res.json({ order: detail });
}

export const addressSchema = z.object({
  label: optionalText(60),
  fullName: text(120, 2),
  phone: indianMobile,
  line1: text(200, 3),
  line2: optionalText(200),
  city: text(100, 2),
  state: z.string().trim().refine((s) => INDIAN_STATES.includes(s), 'Choose your state or union territory.'),
  pincode,
  isDefault: z.boolean().optional(),
});

export async function addresses(req, res) {
  const items = await query(
    `SELECT id, label, full_name, phone, line1, line2, city, state, pincode, country, is_default
       FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC`,
    [req.customer.id],
  );
  res.json({ items });
}

export async function createAddress(req, res) {
  const d = req.valid.body;
  const id = await withTransaction(async (conn) => {
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM customer_addresses WHERE customer_id = ?', [req.customer.id]);
    if (n >= 10) throw new HttpError(400, 'You can save up to 10 addresses.');
    const makeDefault = d.isDefault || n === 0;
    if (makeDefault) await conn.query('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?', [req.customer.id]);
    const [r] = await conn.query(
      `INSERT INTO customer_addresses (customer_id, label, full_name, phone, line1, line2, city, state, pincode, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'India', ?)`,
      [req.customer.id, d.label, d.fullName, d.phone, d.line1, d.line2, d.city, d.state, d.pincode, makeDefault ? 1 : 0],
    );
    return r.insertId;
  });
  res.status(201).json({ id });
}

export async function deleteAddress(req, res) {
  const row = await queryOne('SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?', [req.params.id, req.customer.id]);
  if (!row) throw notFound('Address not found.');
  await query('DELETE FROM customer_addresses WHERE id = ?', [row.id]);
  res.json({ ok: true });
}
