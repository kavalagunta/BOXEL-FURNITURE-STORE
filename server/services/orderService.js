import { queryOne, query, withTransaction } from '../config/db.js';
import { getSettings, flag } from './settingsService.js';
import { quoteCart } from './pricingService.js';
import { generateOrderNumber, toRupees } from '../utils/helpers.js';
import { HttpError } from '../utils/httpError.js';

export const ORDER_STATUSES = [
  'placed',
  'pending',
  'accepted',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'rejected',
  'cancelled',
];

/**
 * Fulfilment transition policy:
 *   placed / pending → accepted / confirmed | rejected / cancelled
 *   accepted / confirmed → processing | shipped | rejected / cancelled
 *   processing → shipped | rejected / cancelled
 *   shipped → delivered
 *   delivered, rejected, cancelled → (final)
 * Orders only move forward; cancelling / rejecting restores tracked stock.
 */
export const TRANSITIONS = {
  placed: ['accepted', 'rejected', 'cancelled'],
  pending: ['accepted', 'confirmed', 'rejected', 'cancelled'],
  accepted: ['processing', 'shipped', 'rejected', 'cancelled'],
  confirmed: ['processing', 'shipped', 'rejected', 'cancelled'],
  processing: ['shipped', 'cancelled', 'rejected'],
  shipped: ['delivered'],
  delivered: [],
  rejected: [],
  cancelled: [],
};

export function enabledPaymentMethods(settings) {
  const methods = [];
  if (flag(settings, 'cod_enabled')) methods.push('cod');
  if (flag(settings, 'bank_transfer_enabled')) methods.push('bank_transfer');
  // Online payment stays disabled until a payment provider is integrated and configured.
  return methods;
}

const insertOrderSql = `INSERT INTO orders (order_number, idempotency_key, customer_id, customer_name, customer_email, customer_phone,
  ship_line1, ship_line2, ship_city, ship_state, ship_pincode, ship_country, delivery_instructions, order_notes,
  subtotal, shipping_fee, tax_amount, tax_label, tax_inclusive, discount_amount, total, currency, status,
  payment_method, payment_status, ip_address)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'INR', 'pending', ?, 'pending', ?)`;

/**
 * Creates an order atomically:
 * validates live product data, locks variant rows, recalculates every total,
 * decrements tracked stock, snapshots items, and records payment + status history.
 * Safe to retry: the same idempotency key always returns the same order.
 */
export async function createOrder({ data, customerId, ip }) {
  const existing = await queryOne('SELECT id, order_number, customer_id FROM orders WHERE idempotency_key = ?', [data.idempotencyKey]);
  if (existing) return { orderId: existing.id, orderNumber: existing.order_number, duplicate: true };

  const settings = await getSettings({ fresh: true });
  if (!enabledPaymentMethods(settings).includes(data.paymentMethod)) {
    throw new HttpError(422, 'The selected payment method is not available.', { fields: { paymentMethod: 'Choose an available payment method.' } });
  }

  try {
    return await withTransaction(async (conn) => {
      const quote = await quoteCart(data.items, { conn, lock: true, settings });
      if (!quote.lines.length) throw new HttpError(422, 'Your cart is empty.');
      if (!quote.purchasable) {
        throw new HttpError(409, 'Some items in your cart changed. Please review your cart.', { code: 'CART_CHANGED', details: quote.issues });
      }
      if (data.expectedTotal !== undefined && Math.abs(Number(data.expectedTotal) - quote.total) > 0.009) {
        throw new HttpError(409, `The total has changed to ₹${quote.total.toLocaleString('en-IN')}. Please review your order before placing it.`, {
          code: 'TOTAL_CHANGED',
          details: { total: quote.total },
        });
      }

      // Atomic stock decrement for stock-tracked products (made-to-order products have no ceiling).
      for (const line of quote.lines) {
        if (!line.trackStock) continue;
        const [res] = await conn.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
          [line.quantity, line.variantId, line.quantity],
        );
        if (res.affectedRows !== 1) throw new HttpError(409, `${line.name} (${line.variantName}) just sold out.`, { code: 'CART_CHANGED' });
      }

      const p = quote._paise;
      const params = (orderNumber) => [
        orderNumber, data.idempotencyKey, customerId ?? null, data.fullName, data.email, data.phone,
        data.line1, data.line2, data.city, data.state, data.pincode, 'India', data.deliveryInstructions, data.orderNotes,
        toRupees(p.subtotal), toRupees(p.shipping), toRupees(p.tax), quote.tax.label, quote.tax.inclusive ? 1 : 0, toRupees(p.total),
        data.paymentMethod, ip,
      ];

      let orderId;
      let orderNumber;
      for (let attempt = 0; attempt < 6 && !orderId; attempt += 1) {
        orderNumber = generateOrderNumber();
        try {
          const [res] = await conn.query(insertOrderSql, params(orderNumber));
          orderId = res.insertId;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY' && /uq_orders_number/.test(err.message)) continue;
          throw err;
        }
      }
      if (!orderId) throw new Error('Could not allocate a unique order number.');

      const itemRows = quote.lines.map((l) => [
        orderId, l.productId, l.variantId, l.name, l.slug, l.sku, l.variantName, l.colorHex, l.imageUrl,
        toRupees(l._unitPaise), l.quantity, toRupees(l._lineTotalPaise),
      ]);
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_slug, sku, variant_name, color_hex, image_url, unit_price, quantity, line_total) VALUES ?`,
        [itemRows],
      );
      await conn.query(
        `INSERT IGNORE INTO admin_order_notifications (admin_id, order_id)
         SELECT id, ? FROM admins WHERE is_active = 1`,
        [orderId],
      );
      await conn.query('INSERT INTO payments (order_id, method, amount, status) VALUES (?, ?, ?, ?)', [orderId, data.paymentMethod, toRupees(p.total), 'pending']);
      await conn.query(
        'INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_label, note) VALUES (?, NULL, ?, ?, ?)',
        [orderId, 'pending', customerId ? 'customer' : 'guest checkout', 'Order placed'],
      );

      if (customerId && data.saveAddress) {
        const [dupe] = await conn.query(
          'SELECT id FROM customer_addresses WHERE customer_id = ? AND line1 = ? AND pincode = ? LIMIT 1',
          [customerId, data.line1, data.pincode],
        );
        if (!dupe.length) {
          const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM customer_addresses WHERE customer_id = ?', [customerId]);
          await conn.query(
            `INSERT INTO customer_addresses (customer_id, full_name, phone, line1, line2, city, state, pincode, country, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'India', ?)`,
            [customerId, data.fullName, data.phone, data.line1, data.line2, data.city, data.state, data.pincode, n === 0 ? 1 : 0],
          );
        }
      }
      if (customerId) {
        await conn.query('DELETE ci FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.customer_id = ?', [customerId]);
      }

      return { orderId, orderNumber, duplicate: false };
    });
  } catch (err) {
    // A concurrent retry with the same key won the race — return that order instead of failing.
    if (err.code === 'ER_DUP_ENTRY' && /uq_orders_idem/.test(err.message)) {
      const again = await queryOne('SELECT id, order_number FROM orders WHERE idempotency_key = ?', [data.idempotencyKey]);
      if (again) return { orderId: again.id, orderNumber: again.order_number, duplicate: true };
    }
    throw err;
  }
}

/** Full order with items, history and tracking — shape shared by customer and admin views. */
export async function getOrderDetail(where, params, { includeInternal = false } = {}) {
  const order = await queryOne(`SELECT * FROM orders WHERE ${where} LIMIT 1`, params);
  if (!order) return null;
  const items = await query(
    `SELECT id, product_id, variant_id, product_name, product_slug, sku, variant_name, color_hex, image_url, unit_price, quantity, line_total
       FROM order_items WHERE order_id = ? ORDER BY id`,
    [order.id],
  );
  const history = await query(
    `SELECT h.id, h.from_status, h.to_status, h.changed_by_label, h.note, h.created_at${includeInternal ? ', a.name AS admin_name' : ''}
       FROM order_status_history h ${includeInternal ? 'LEFT JOIN admins a ON a.id = h.changed_by_admin_id' : ''}
      WHERE h.order_id = ? ORDER BY h.created_at, h.id`,
    [order.id],
  );
  const emails = await query(
    `SELECT id, type, recipient, subject, message_body, status, error_message, attempts, last_attempt_at, sent_at, created_at 
       FROM email_notification_logs WHERE related_type = 'order' AND related_id = ? ORDER BY created_at DESC`,
    [order.id],
  );
  const notifications = await query(
    `SELECT id, order_id, channel, recipient, type, status, error, fallback_link, attempts, created_at, updated_at
       FROM notifications_log WHERE order_id = ? ORDER BY created_at DESC, id DESC`,
    [order.id],
  );
  const out = { ...order, items, history, emails, notifications };
  if (!includeInternal) {
    delete out.ip_address;
    delete out.idempotency_key;
    // Staff names stay internal; customers only see what changed and when.
    out.history = history.map(({ changed_by_label: _internal, ...h }) => h);
  }
  return out;
}

/** Restores stock for tracked variants of a cancelled order. Runs inside a transaction. */
async function restock(conn, orderId) {
  const [items] = await conn.query(
    `SELECT oi.variant_id, oi.quantity FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
      WHERE oi.order_id = ? AND p.track_stock = 1`,
    [orderId],
  );
  for (const it of items) {
    await conn.query('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?', [it.quantity, it.variant_id]);
  }
}

export async function changeOrderStatus({ orderId, toStatus, admin, note, cancelReason, rejectionReason }) {
  return withTransaction(async (conn) => {
    const [[order]] = await conn.query('SELECT id, status, payment_status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === toStatus) throw new HttpError(409, 'The order already has this status.');
    
    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(toStatus)) {
      throw new HttpError(409, `An order that is ${order.status} cannot be moved to ${toStatus}.`);
    }

    const reason = rejectionReason || cancelReason || note || null;

    if (toStatus === 'rejected' || toStatus === 'cancelled') {
      await restock(conn, orderId);
      const newPayment = order.payment_status === 'paid' ? 'paid' : 'cancelled';
      await conn.query(
        `UPDATE orders 
         SET status = ?, payment_status = ?, cancel_reason = ?, rejection_reason = ?, 
             rejected_at = UTC_TIMESTAMP(), cancelled_at = UTC_TIMESTAMP() 
         WHERE id = ?`,
        [toStatus, newPayment, reason, reason, orderId],
      );
      if (newPayment === 'cancelled') {
        await conn.query("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'", [orderId]);
      }
    } else if (toStatus === 'accepted' || toStatus === 'confirmed') {
      await conn.query(
        'UPDATE orders SET status = ?, accepted_at = UTC_TIMESTAMP(), accepted_by = ? WHERE id = ?',
        [toStatus, admin?.id || null, orderId],
      );
    } else {
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', [toStatus, orderId]);
    }

    await conn.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_admin_id, changed_by_label, note) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, order.status, toStatus, admin?.id || null, admin?.name || 'admin', note || reason || null],
    );
    return { from: order.status, to: toStatus, paymentStatusWasPaid: order.payment_status === 'paid' };
  });
}

/**
 * Records a payment as received. This is a deliberate, logged staff action
 * (e.g. COD cash collected, bank transfer reconciled) — never automatic.
 */
export async function recordPayment({ orderId, admin, reference, notes, status }) {
  return withTransaction(async (conn) => {
    const [[order]] = await conn.query('SELECT id, status, payment_status, payment_method, total FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!order) throw new HttpError(404, 'Order not found.');
    const allowed = {
      paid: ['pending', 'failed'],
      failed: ['pending'],
      refunded: ['paid'],
    };
    if (!allowed[status]?.includes(order.payment_status)) {
      throw new HttpError(409, `Payment that is ${order.payment_status} cannot be marked ${status}.`);
    }
    if (status === 'paid' && order.status === 'cancelled') throw new HttpError(409, 'This order is cancelled.');

    await conn.query('UPDATE orders SET payment_status = ? WHERE id = ?', [status, orderId]);
    const [[payment]] = await conn.query('SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
    if (payment) {
      await conn.query(
        `UPDATE payments SET status = ?, provider_reference = COALESCE(?, provider_reference), notes = ?, recorded_by = ?,
                paid_at = IF(? = 'paid', UTC_TIMESTAMP(), paid_at) WHERE id = ?`,
        [status, reference || null, notes || null, admin.id, status, payment.id],
      );
    } else {
      await conn.query(
        `INSERT INTO payments (order_id, method, amount, status, provider_reference, notes, recorded_by, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, IF(? = 'paid', UTC_TIMESTAMP(), NULL))`,
        [orderId, order.payment_method, order.total, status, reference || null, notes || null, admin.id, status],
      );
    }
    await conn.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_admin_id, changed_by_label, note) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, order.status, order.status, admin.id, admin.name, `Payment marked ${status}${reference ? ` (ref ${reference})` : ''}`],
    );
    return { from: order.payment_status, to: status };
  });
}
