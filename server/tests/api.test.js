import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, db, client, adminClient, setSetting, validCheckout, uuid } from './helpers.js';

after(async () => {
  await db.pool.end();
});

describe('security basics', () => {
  it('rejects state-changing requests without a CSRF token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'CSRF');
  });

  it('sets an HTTP-only session cookie', async () => {
    const res = await request(app).get('/api/csrf');
    const cookie = res.headers['set-cookie']?.[0] || '';
    assert.match(cookie, /boxel\.sid=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
  });
});

describe('customer authentication', () => {
  const email = `customer-${Date.now()}@example.com`;

  it('validates registration input', async () => {
    const c = await client();
    const res = await c.post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'short' });
    assert.equal(res.status, 422);
    assert.ok(res.body.fields.email);
    assert.ok(res.body.fields.password);
  });

  it('registers, signs out and signs in', async () => {
    const c = await client();
    let res = await c.post('/api/auth/register').send({ name: 'Ravi Kumar', email, password: 'StrongPass123' });
    assert.equal(res.status, 201);
    res = await c.get('/api/auth/me');
    assert.equal(res.body.customer.email, email);
    assert.equal(res.body.customer.password_hash, undefined);

    res = await c.post('/api/auth/logout');
    assert.equal(res.status, 200);
    res = await c.get('/api/auth/me');
    assert.equal(res.body.customer, null);

    res = await c.post('/api/auth/login').send({ email, password: 'WrongPass123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Email or password is incorrect.');

    res = await c.post('/api/auth/login').send({ email: 'nobody@example.com', password: 'WrongPass123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Email or password is incorrect.');

    res = await c.post('/api/auth/login').send({ email, password: 'StrongPass123' });
    assert.equal(res.status, 200);
  });

  it('rejects duplicate registration', async () => {
    const c = await client();
    const res = await c.post('/api/auth/register').send({ name: 'Ravi Kumar', email, password: 'StrongPass123' });
    assert.equal(res.status, 409);
  });
});

describe('product catalogue', () => {
  it('lists published products with live data', async () => {
    const res = await request(app).get('/api/products');
    assert.equal(res.status, 200);
    const pdb = res.body.items.find((p) => p.slug === 'parcel-drop-box');
    assert.ok(pdb);
    assert.equal(pdb.price, 0);
    assert.equal(pdb.availability, 'price_not_set');
    assert.equal(pdb.rating, null, 'no fake ratings');
    assert.equal(pdb.variants[0].name, 'White');
  });

  it('returns product detail by slug and 404 for unknown slugs', async () => {
    let res = await request(app).get('/api/products/parcel-drop-box');
    assert.equal(res.status, 200);
    assert.ok(res.body.product.features.includes('Keyless number lock'));
    res = await request(app).get('/api/products/nope');
    assert.equal(res.status, 404);
  });

  it('lists coming-soon categories', async () => {
    const res = await request(app).get('/api/categories');
    const soon = res.body.items.filter((c) => c.status === 'coming_soon').map((c) => c.slug);
    assert.ok(soon.includes('personal-storage'));
  });

  it('validates list query parameters', async () => {
    const res = await request(app).get('/api/products?sort=evil');
    assert.equal(res.status, 422);
  });

  it('generates a sitemap containing product URLs', async () => {
    const res = await request(app).get('/sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.text, /\/products\/parcel-drop-box/);
  });
});

describe('admin access control', () => {
  it('blocks unauthenticated admin API access', async () => {
    const c = await client();
    for (const url of ['/api/admin/dashboard', '/api/admin/products', '/api/admin/orders', '/api/admin/settings/store']) {
      const res = await c.get(url);
      assert.equal(res.status, 401, url);
    }
  });

  it('does not let a customer session reach admin APIs', async () => {
    const c = await client();
    await c.post('/api/auth/register').send({ name: 'Sneaky', email: `sneaky-${Date.now()}@example.com`, password: 'StrongPass123' });
    const res = await c.get('/api/admin/orders');
    assert.equal(res.status, 401);
  });

  it('enforces roles', async () => {
    const support = await adminClient('support');
    assert.equal((await support.get('/api/admin/orders')).status, 200);
    assert.equal((await support.get('/api/admin/products')).status, 403);
    assert.equal((await support.get('/api/admin/users')).status, 403);
    const admin = await adminClient('admin');
    assert.equal((await admin.get('/api/admin/products')).status, 200);
    assert.equal((await admin.get('/api/admin/users')).status, 403);
    assert.equal((await admin.put('/api/admin/settings/email').send({ settings: {} })).status, 403);
  });

  it('uses a generic error for bad admin credentials', async () => {
    const c = await client();
    const res = await c.post('/api/admin/auth/login').send({ email: 'super_admin@test.boxel', password: 'wrong-password-1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Email or password is incorrect.');
  });
});

describe('product administration', () => {
  let admin;
  let productId;
  before(async () => {
    admin = await adminClient('super_admin');
  });

  const payload = (overrides = {}) => ({
    name: 'Test Locker',
    sku: `TL-${Date.now()}`,
    category_id: 1,
    short_description: 'A locker for tests',
    description: 'Long description',
    features: ['All metal'],
    specifications: [{ label: 'Finish', value: 'Powder coat' }],
    price: 4999,
    sale_price: '',
    status: 'active',
    is_featured: false,
    track_stock: true,
    variants: [{ name: 'Grey', color_hex: '#888888', stock_quantity: 1, price_adjustment: 0, is_active: true }],
    images: [{ url: '/images/parcel-drop-box-open.jpeg', alt: 'Test' }],
    ...overrides,
  });

  it('validates product input on the server', async () => {
    const res = await admin.post('/api/admin/products').send(payload({ price: -5, variants: [], sale_price: 99999 }));
    assert.equal(res.status, 422);
    assert.ok(res.body.fields.price);
    assert.ok(res.body.fields.variants);
  });

  it('creates, updates and lists a product', async () => {
    let res = await admin.post('/api/admin/products').send(payload());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    productId = res.body.id;
    res = await admin.get(`/api/admin/products/${productId}`);
    assert.equal(res.body.product.slug, 'test-locker');
    const variant = res.body.product.variants[0];

    res = await admin.put(`/api/admin/products/${productId}`).send(payload({ name: 'Test Locker Pro', slug: 'test-locker', sku: res.body.product.sku, variants: [{ ...variant, stock_quantity: 1 }] }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    res = await request(app).get('/api/products/test-locker');
    assert.equal(res.body.product.name, 'Test Locker Pro');
    assert.equal(res.body.product.price, 4999);
  });

  it('rejects duplicate slugs', async () => {
    const res = await admin.post('/api/admin/products').send(payload({ slug: 'test-locker', sku: 'OTHER-SKU' }));
    assert.equal(res.status, 409);
  });

  it('records admin activity', async () => {
    const rows = await db.query("SELECT action FROM admin_activity_logs WHERE entity_type = 'product' AND entity_id = ?", [String(productId)]);
    assert.ok(rows.some((r) => r.action === 'product.create'));
    assert.ok(rows.some((r) => r.action === 'product.update'));
  });

  it('prevents overselling a stock-tracked product', async () => {
    await setSetting('cod_enabled', '1');
    const [variant] = await db.query('SELECT id FROM product_variants WHERE product_id = ?', [productId]);
    const c = await client();
    let res = await c.post('/api/orders').send(validCheckout({ items: [{ variantId: variant.id, quantity: 2 }] }));
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'CART_CHANGED');
    res = await c.post('/api/orders').send(validCheckout({ items: [{ variantId: variant.id, quantity: 1 }] }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [{ stock_quantity }] = await db.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variant.id]);
    assert.equal(stock_quantity, 0);
  });

  it('refuses to delete a product with order history, but allows archiving', async () => {
    let res = await admin.delete(`/api/admin/products/${productId}`);
    assert.equal(res.status, 409);
    res = await admin.post(`/api/admin/products/${productId}/archive`);
    assert.equal(res.status, 200);
    res = await request(app).get('/api/products/test-locker');
    assert.equal(res.status, 404);
  });

  it('protects categories that still contain products', async () => {
    const res = await admin.delete('/api/admin/categories/1');
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'HAS_PRODUCTS');
  });
});

describe('checkout and orders', () => {
  let admin;
  before(async () => {
    admin = await adminClient('super_admin');
    await setSetting('cod_enabled', '0');
    await db.query('UPDATE products SET price = 0 WHERE id = 1');
  });

  it('refuses to sell a product without a price', async () => {
    await setSetting('cod_enabled', '1');
    const c = await client();
    const res = await c.post('/api/orders').send(validCheckout());
    assert.equal(res.status, 409);
    assert.equal(res.body.details[0].code, 'price_not_set');
  });

  it('refuses disabled payment methods', async () => {
    await db.query('UPDATE products SET price = 12500.00 WHERE id = 1');
    await setSetting('cod_enabled', '0');
    const c = await client();
    let res = await c.post('/api/orders').send(validCheckout());
    assert.equal(res.status, 422);
    res = await c.post('/api/orders').send(validCheckout({ paymentMethod: 'online' }));
    assert.equal(res.status, 422);
    await setSetting('cod_enabled', '1');
  });

  it('validates checkout fields', async () => {
    const c = await client();
    const res = await c.post('/api/orders').send(validCheckout({ phone: '12345', pincode: '012345', state: 'Atlantis', email: 'x', items: [] }));
    assert.equal(res.status, 422);
    for (const f of ['phone', 'pincode', 'state', 'email', 'items']) assert.ok(res.body.fields[f], f);
  });

  it('accepts common Indian mobile formats', async () => {
    const c = await client();
    for (const phone of ['9845012345', '+919845012345', '09845012345', '+91 98450-12345']) {
      const res = await c.post('/api/cart/quote').send({ items: [{ variantId: 1, quantity: 1 }] });
      assert.equal(res.status, 200);
      const { normalizeIndianMobile } = await import('../utils/validators.js');
      assert.equal(normalizeIndianMobile(phone), '+919845012345', phone);
    }
  });

  it('ignores client prices and recalculates totals on the server', async () => {
    const c = await client();
    const res = await c.post('/api/cart/quote').send({ items: [{ variantId: 1, quantity: 2, price: 1 }, { variantId: 1, quantity: 1 }] });
    assert.equal(res.body.lines.length, 1, 'duplicate variants merge');
    assert.equal(res.body.lines[0].quantity, 3);
    assert.equal(res.body.subtotal, 37500);
    assert.equal(res.body.shipping, 0);
    assert.equal(res.body.total, 37500);
  });

  it('creates an order in a transaction with snapshots, payment and history', async () => {
    const c = await client();
    const body = validCheckout({ expectedTotal: 25000 });
    const res = await c.post('/api/orders').send(body);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.orderNumber, /^BX-\d{6}-[A-Z0-9]{5}$/);

    const [order] = await db.query('SELECT * FROM orders WHERE order_number = ?', [res.body.orderNumber]);
    assert.equal(Number(order.subtotal), 25000);
    assert.equal(Number(order.total), 25000);
    assert.equal(order.customer_phone, '+919845012345');
    assert.equal(order.ship_pincode, '560038');
    assert.equal(order.status, 'pending');
    assert.equal(order.payment_status, 'pending', 'never marked paid automatically');

    const items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    assert.equal(items.length, 1);
    assert.equal(items[0].product_name, 'boxel Parcel Drop Box');
    assert.equal(items[0].variant_name, 'White');
    assert.equal(Number(items[0].unit_price), 12500);

    const payments = await db.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
    assert.equal(payments[0].status, 'pending');
    const history = await db.query('SELECT * FROM order_status_history WHERE order_id = ?', [order.id]);
    assert.equal(history[0].to_status, 'pending');

    // Email is attempted after commit and logged (skipped without SMTP) — the order itself succeeded.
    await new Promise((r) => setTimeout(r, 300));
    const logs = await db.query("SELECT status FROM email_notification_logs WHERE related_type = 'order' AND related_id = ?", [order.id]);
    assert.ok(logs.length >= 1);

    // Confirmation is visible to the session that placed it, and not to others.
    assert.equal((await c.get(`/api/orders/confirmation/${res.body.orderNumber}`)).status, 200);
    const stranger = await client();
    assert.equal((await stranger.get(`/api/orders/confirmation/${res.body.orderNumber}`)).status, 404);
  });

  it('is idempotent on retries', async () => {
    const c = await client();
    const body = validCheckout();
    const first = await c.post('/api/orders').send(body);
    const second = await c.post('/api/orders').send(body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.orderNumber, first.body.orderNumber);
    const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?', [body.idempotencyKey]);
    assert.equal(Number(n), 1);
  });

  it('rejects an order when the total changed since the customer reviewed it', async () => {
    const c = await client();
    const res = await c.post('/api/orders').send(validCheckout({ expectedTotal: 100 }));
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'TOTAL_CHANGED');
  });

  it('restricts order history to the owning customer', async () => {
    const alice = await client();
    await alice.post('/api/auth/register').send({ name: 'Alice', email: `alice-${Date.now()}@example.com`, password: 'StrongPass123' });
    const placed = await alice.post('/api/orders').send(validCheckout({ idempotencyKey: uuid() }));
    assert.equal(placed.status, 201);
    const list = await alice.get('/api/account/orders');
    assert.equal(list.body.items.length, 1);
    assert.equal((await alice.get(`/api/account/orders/${placed.body.orderNumber}`)).status, 200);

    const bob = await client();
    await bob.post('/api/auth/register').send({ name: 'Bob', email: `bob-${Date.now()}@example.com`, password: 'StrongPass123' });
    assert.equal((await bob.get(`/api/account/orders/${placed.body.orderNumber}`)).status, 404);
    assert.equal((await bob.get('/api/account/orders')).body.items.length, 0);
    assert.equal((await bob.get(`/api/orders/confirmation/${placed.body.orderNumber}`)).status, 404);
  });

  it('enforces the order status transition policy and records who changed it', async () => {
    const c = await client();
    const placed = await c.post('/api/orders').send(validCheckout());
    const [order] = await db.query('SELECT id FROM orders WHERE order_number = ?', [placed.body.orderNumber]);
    let res = await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'delivered', notifyCustomer: false });
    assert.equal(res.status, 409);
    res = await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'confirmed', notifyCustomer: false });
    assert.equal(res.status, 200);
    const [h] = await db.query("SELECT changed_by_admin_id, changed_by_label FROM order_status_history WHERE order_id = ? AND to_status = 'confirmed'", [order.id]);
    assert.ok(h.changed_by_admin_id);
    res = await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'cancelled', cancelReason: 'Customer request', notifyCustomer: false });
    assert.equal(res.status, 200);
    const [o] = await db.query('SELECT status, payment_status FROM orders WHERE id = ?', [order.id]);
    assert.equal(o.status, 'cancelled');
    assert.equal(o.payment_status, 'cancelled');
  });

  it('separates gross order value from collected revenue', async () => {
    const res = await admin.get('/api/admin/dashboard');
    assert.equal(res.status, 200);
    assert.ok(res.body.metrics.grossOrderValue > 0);
    assert.equal(res.body.metrics.collectedRevenue, 0, 'nothing paid yet');
  });
});

describe('enquiries and reviews', () => {
  it('stores a contact enquiry with a reference', async () => {
    const c = await client();
    let res = await c.post('/api/enquiries').send({ topic: 'Product question', name: 'Meera', email: 'meera@example.com', message: 'Does it fit narrow corridors?', consent: false });
    assert.equal(res.status, 422);
    res = await c.post('/api/enquiries').send({ topic: 'Product question', name: 'Meera', email: 'meera@example.com', message: '<b>Does</b> it fit narrow corridors?', consent: true });
    assert.equal(res.status, 201);
    const [row] = await db.query('SELECT message FROM enquiries WHERE reference = ?', [res.body.reference]);
    assert.equal(row.message, 'Does it fit narrow corridors?', 'tags stripped');
  });

  it('requires sign-in and moderation for reviews', async () => {
    const anon = await client();
    assert.equal((await anon.post('/api/products/parcel-drop-box/reviews').send({ rating: 5, title: 'Great', body: 'Really useful box.', displayName: 'R' })).status, 401);

    const c = await client();
    await c.post('/api/auth/register').send({ name: 'Reviewer', email: `rev-${Date.now()}@example.com`, password: 'StrongPass123' });
    const res = await c.post('/api/products/parcel-drop-box/reviews').send({ rating: 4, title: 'Solid build', body: 'Feels sturdy and well made.', displayName: 'Kiran' });
    assert.equal(res.status, 201);
    const pub = await request(app).get('/api/products/parcel-drop-box/reviews');
    assert.equal(pub.body.items.length, 0, 'pending reviews are not public');
  });
});
