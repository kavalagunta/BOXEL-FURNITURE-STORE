import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { quoteCart, publicQuote, normalizeItems, MAX_QTY_PER_LINE } from '../services/pricingService.js';

export const cartItemsSchema = z.object({
  items: z
    .array(z.object({ variantId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(99) }))
    .max(50),
});

/** Prices any cart from live data — used by the cart page, drawer and checkout summary. */
export async function quote(req, res) {
  const q = await quoteCart(req.valid.body.items);
  res.json(publicQuote(q));
}

/** Server-side cart for signed-in customers (stored as variant + quantity only). */
export async function getCart(req, res) {
  const rows = await query(
    `SELECT ci.variant_id AS variantId, ci.quantity FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
      WHERE c.customer_id = ? ORDER BY ci.id`,
    [req.customer.id],
  );
  res.json({ items: rows });
}

export async function saveCart(req, res) {
  const items = normalizeItems(req.valid.body.items).map((i) => ({ ...i, quantity: Math.min(i.quantity, MAX_QTY_PER_LINE) }));
  await withTransaction(async (conn) => {
    await conn.query('INSERT INTO carts (customer_id) VALUES (?) ON DUPLICATE KEY UPDATE updated_at = UTC_TIMESTAMP()', [req.customer.id]);
    const [[cart]] = await conn.query('SELECT id FROM carts WHERE customer_id = ?', [req.customer.id]);
    await conn.query('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    if (items.length) {
      const [valid] = await conn.query('SELECT id FROM product_variants WHERE id IN (?)', [items.map((i) => i.variantId)]);
      const ok = new Set(valid.map((v) => v.id));
      const rows = items.filter((i) => ok.has(i.variantId)).map((i) => [cart.id, i.variantId, i.quantity]);
      if (rows.length) await conn.query('INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ?', [rows]);
    }
  });
  res.json({ ok: true });
}
