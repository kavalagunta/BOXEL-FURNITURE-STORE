import { query, queryOne } from '../../config/db.js';
import { getSettings } from '../../services/settingsService.js';
import { enabledPaymentMethods } from '../../services/orderService.js';
import { smtpConfigured } from '../../services/emailService.js';

/** Start of "today" in India (IST, UTC+05:30), expressed in UTC for DATETIME comparisons. */
function istMidnightUtc(daysAgo = 0) {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60_000);
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - daysAgo);
  return new Date(ist.getTime() - 330 * 60_000);
}

/**
 * All figures come straight from the database.
 * "Gross order value" = totals of orders that are not cancelled (paid or not).
 * "Collected revenue" = payments explicitly recorded as paid. Cancelled/unpaid orders never count.
 */
export async function stats(_req, res) {
  const today = istMidnightUtc(0);
  const since = istMidnightUtc(29);

  const [orders, collected, customers, enquiries, lowStock, statusRows, salesRows, recentOrders, recentEnquiries, zeroPrice, pendingReviews, failedEmails] =
    await Promise.all([
      queryOne(
        `SELECT COUNT(*) AS total,
                SUM(created_at >= ?) AS today,
                SUM(status = 'pending') AS pending,
                SUM(status = 'delivered') AS completed,
                COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total END), 0) AS gross_value
           FROM orders`,
        [today],
      ),
      queryOne("SELECT COALESCE(SUM(p.amount), 0) AS amount FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.status = 'paid' AND o.payment_status = 'paid'"),
      queryOne('SELECT COUNT(*) AS n FROM customers'),
      queryOne("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'"),
      query(
        `SELECT p.id AS product_id, p.name, v.id AS variant_id, v.name AS variant_name, v.stock_quantity, p.low_stock_threshold
           FROM product_variants v JOIN products p ON p.id = v.product_id
          WHERE p.track_stock = 1 AND p.status = 'active' AND v.is_active = 1 AND v.stock_quantity <= p.low_stock_threshold
          ORDER BY v.stock_quantity ASC LIMIT 10`,
      ),
      query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status'),
      query(
        `SELECT DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS value
           FROM orders WHERE created_at >= ? AND status <> 'cancelled'
          GROUP BY day ORDER BY day`,
        [since],
      ),
      query(
        `SELECT id, order_number, customer_name, total, status, payment_status, created_at FROM orders ORDER BY created_at DESC LIMIT 6`,
      ),
      query('SELECT id, reference, name, topic, status, created_at FROM enquiries ORDER BY created_at DESC LIMIT 5'),
      query("SELECT id, name FROM products WHERE status = 'active' AND price <= 0"),
      queryOne("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'"),
      queryOne("SELECT COUNT(*) AS n FROM email_notification_logs WHERE status = 'failed'"),
    ]);

  // Fill missing days so the chart has a continuous 30-day axis.
  const byDay = new Map(salesRows.map((r) => [new Date(r.day).toISOString().slice(0, 10), r]));
  const sales = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(istMidnightUtc(i).getTime() + 330 * 60_000).toISOString().slice(0, 10);
    const r = byDay.get(d);
    sales.push({ day: d, orders: r ? Number(r.orders) : 0, value: r ? Number(r.value) : 0 });
  }

  const settings = await getSettings();
  const warnings = [];
  for (const p of zeroPrice) warnings.push({ type: 'price', message: `${p.name} has no price yet, so customers cannot order it.`, link: `/admin/products/${p.id}/edit` });
  if (!enabledPaymentMethods(settings).length) warnings.push({ type: 'payment', message: 'No payment method is enabled, so checkout is closed. Enable one in Store settings → Payments.', link: '/admin/store-settings' });
  if (!smtpConfigured()) warnings.push({ type: 'smtp', message: 'SMTP is not configured — order and enquiry emails are not being sent.', link: '/admin/email-settings' });
  if (Number(failedEmails.n) > 0) warnings.push({ type: 'email', message: `${failedEmails.n} email notification(s) failed and can be retried.`, link: '/admin/email-settings' });

  res.json({
    metrics: {
      totalOrders: Number(orders.total),
      ordersToday: Number(orders.today || 0),
      pendingOrders: Number(orders.pending || 0),
      completedOrders: Number(orders.completed || 0),
      grossOrderValue: Number(orders.gross_value),
      collectedRevenue: Number(collected.amount),
      customers: Number(customers.n),
      unreadEnquiries: Number(enquiries.n),
      pendingReviews: Number(pendingReviews.n),
      lowStockCount: lowStock.length,
    },
    lowStock,
    statusDistribution: Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)])),
    sales,
    recentOrders,
    recentEnquiries,
    warnings,
  });
}

/** Lightweight counts for the admin header's notification bell. */
export async function notifications(_req, res) {
  const [orders, enquiries, reviews, emails] = await Promise.all([
    queryOne("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
    queryOne("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'"),
    queryOne("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'"),
    queryOne("SELECT COUNT(*) AS n FROM email_notification_logs WHERE status = 'failed'"),
  ]);
  const items = [
    { key: 'orders', count: Number(orders.n), label: 'orders awaiting confirmation', link: '/admin/orders?status=pending' },
    { key: 'enquiries', count: Number(enquiries.n), label: 'new enquiries', link: '/admin/enquiries?status=new' },
    { key: 'reviews', count: Number(reviews.n), label: 'reviews to moderate', link: '/admin/reviews?status=pending' },
    { key: 'emails', count: Number(emails.n), label: 'failed emails', link: '/admin/email-settings' },
  ].filter((i) => i.count > 0);
  res.json({ items, total: items.reduce((s, i) => s + i.count, 0) });
}

/** Global admin search across orders, customers and products. */
export async function search(req, res) {
  const term = String(req.query.q || '').trim().slice(0, 80);
  if (term.length < 2) return res.json({ orders: [], customers: [], products: [] });
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [orders, customers, products] = await Promise.all([
    query('SELECT id, order_number, customer_name, total FROM orders WHERE order_number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ? ORDER BY created_at DESC LIMIT 5', [like, like, like, like]),
    query('SELECT id, name, email FROM customers WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY created_at DESC LIMIT 5', [like, like, like]),
    query('SELECT id, name, sku FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY name LIMIT 5', [like, like]),
  ]);
  res.json({ orders, customers, products });
}
