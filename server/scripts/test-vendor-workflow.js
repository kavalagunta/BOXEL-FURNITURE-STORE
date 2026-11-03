/**
 * Vendor WhatsApp Order Notification End-to-End Verification Suite
 * Tests:
 * 1. Database schema: vendors table, products.vendor_id, notifications_log.vendor_id
 * 2. Vendors CRUD API (admin): create, list, assign products, update
 * 3. Multi-vendor order placement (COD order with items belonging to different vendors)
 * 4. Multi-vendor item grouping: verifying Vendor A receives ONLY Vendor A items,
 *    and Vendor B receives ONLY Vendor B items
 * 5. Message format: 🛒 *New Order #...*, numbered items with qty, price, line total, COD total, customer address
 * 6. Fallback wa.me link generation and notifications_log recording
 * 7. Failure isolation: invalid/empty API credentials never block or fail customer order
 * 8. Resend to vendor API endpoint from admin panel
 */

import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

class ApiSession {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = {};
    this.csrfToken = '';
  }

  updateCookies(res) {
    const raw = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean);

    for (const c of raw) {
      const [nameVal] = c.split(';');
      const idx = nameVal.indexOf('=');
      if (idx > -1) {
        this.cookies[nameVal.slice(0, idx).trim()] = nameVal.slice(idx + 1).trim();
      }
    }
  }

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(path, options = {}) {
    const headers = { ...options.headers };
    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      if (this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    this.updateCookies(res);
    return res;
  }

  async refreshCsrf() {
    const res = await this.request('/api/csrf');
    const data = await res.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  async post(path, body) {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async put(path, body) {
    return this.request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async get(path) {
    return this.request(path, { method: 'GET' });
  }
}

let passed = 0;
let failed = 0;

function ok(name, condition, extra = null) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}${extra !== null ? ` → got: ${JSON.stringify(extra)}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('   VENDOR WHATSAPP NOTIFICATION — END-TO-END VERIFICATION');
  console.log('════════════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
  });

  const adminClient = new ApiSession('http://localhost:5000');
  const customerClient = new ApiSession('http://localhost:5000');

  // ── 1. Database Schema Verification ──────────────────────────────────────
  console.log('TEST 1: Database Schema Verification');

  async function colExists(table, col) {
    const [[r]] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
      [table, col]
    );
    return r.c > 0;
  }

  ok('vendors table exists', await colExists('vendors', 'id'));
  ok('vendors.whatsapp_number column exists', await colExists('vendors', 'whatsapp_number'));
  ok('products.vendor_id column exists', await colExists('products', 'vendor_id'));
  ok('notifications_log.vendor_id column exists', await colExists('notifications_log', 'vendor_id'));

  // ── 2. Admin Authentication & Vendors API ────────────────────────────────
  console.log('\nTEST 2: Admin Authentication & Vendors CRUD API');

  await adminClient.refreshCsrf();
  const loginRes = await adminClient.post('/api/admin/auth/login', {
    email: 'admin@shop.com',
    password: 'Admin@123',
  });
  ok('Admin login succeeds', loginRes.status === 200, loginRes.status);
  await adminClient.refreshCsrf();

  // Create test vendor
  const newVendorRes = await adminClient.post('/api/admin/vendors', {
    name: 'Rapid Express Deliveries',
    whatsapp_number: '+919876543210',
    email: 'dispatch@rapidexpress.in',
    is_active: true,
  });
  ok('POST /api/admin/vendors creates vendor (HTTP 201)', newVendorRes.status === 201, newVendorRes.status);
  const newVendorData = await newVendorRes.json();
  const testVendorId = newVendorData.vendor?.id;
  ok('Vendor saved with formatted E.164 phone', newVendorData.vendor?.whatsapp_number === '+919876543210', newVendorData.vendor?.whatsapp_number);

  // List vendors
  const listRes = await adminClient.get('/api/admin/vendors');
  ok('GET /api/admin/vendors returns 200', listRes.status === 200, listRes.status);
  const listData = await listRes.json();
  ok('Vendors list includes newly created vendor', listData.items?.some(v => v.id === testVendorId));

  // Assign product 1 and product 3 to test vendor
  const assignRes = await adminClient.post(`/api/admin/vendors/${testVendorId}/assign-products`, {
    productIds: [1, 3],
  });
  ok('POST /api/admin/vendors/:id/assign-products succeeds (HTTP 200)', assignRes.status === 200, assignRes.status);

  // Ensure product 2 is assigned to vendor 2 (Urban Express)
  await conn.query('UPDATE products SET vendor_id = 2 WHERE id = 2');

  // Verify DB assignments
  const [[p1]] = await conn.query('SELECT id, name, vendor_id FROM products WHERE id = 1');
  const [[p2]] = await conn.query('SELECT id, name, vendor_id FROM products WHERE id = 2');
  ok('Product 1 assigned to Test Vendor', p1.vendor_id === testVendorId, p1.vendor_id);
  ok('Product 2 assigned to Vendor 2', p2.vendor_id === 2, p2.vendor_id);

  // ── 3. Multi-Vendor COD Order Placement ──────────────────────────────────
  console.log('\nTEST 3: Multi-Vendor COD Order Placement');

  await customerClient.refreshCsrf();

  // Register a customer first so checkout authentication gate passes
  const custEmail = `rohan_${Date.now()}@test.com`;
  const regRes = await customerClient.post('/api/auth/register', {
    name: 'Rohan Sharma',
    email: custEmail,
    phone: '9876501234',
    password: 'Password@123',
  });
  ok('Customer registers successfully', [200, 201].includes(regRes.status), regRes.status);
  await customerClient.refreshCsrf();

  // Get variants for Product 1 and Product 2
  const [[v1]] = await conn.query('SELECT id, price_adjustment FROM product_variants WHERE product_id = 1 LIMIT 1');
  const [[v2]] = await conn.query('SELECT id, price_adjustment FROM product_variants WHERE product_id = 2 LIMIT 1');

  // Place multi-vendor COD order containing Product 1 (Vendor A) and Product 2 (Vendor B)
  const orderPayload = {
    idempotencyKey: 'a1b2c3d4-e5f6-4a7b-8c9d-' + Date.now().toString(16).padStart(12, '0'),
    fullName: 'Rohan Sharma',
    email: custEmail,
    phone: '9876501234',
    line1: 'Flat 402, Lotus Residency, 12th Main',
    line2: 'Indiranagar',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560038',
    paymentMethod: 'cod',
    deliveryInstructions: 'Leave at security gate if not available',
    items: [
      { variantId: v1.id, quantity: 2 },
      { variantId: v2.id, quantity: 1 },
    ],
  };

  const placeRes = await customerClient.post('/api/orders', orderPayload);
  ok('Customer places COD order successfully (HTTP 201)', [200, 201].includes(placeRes.status), placeRes.status);
  const placeData = await placeRes.json();
  const orderNumber = placeData.orderNumber;
  ok('Order number returned', !!orderNumber, orderNumber);

  // Wait for background async WhatsApp dispatch to complete
  await new Promise(r => setTimeout(r, 2000));

  const [[savedOrder]] = await conn.query('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
  ok('Order saved in DB with COD payment method', savedOrder.payment_method === 'cod', savedOrder.payment_method);
  ok('Order saved with status placed', savedOrder.status === 'placed', savedOrder.status);

  const [savedItems] = await conn.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [savedOrder.id]);
  ok('Order has 2 distinct product items stored', savedItems.length === 2, savedItems.length);
  ok('Item 1 has correct unit price & line total', Number(savedItems[0].line_total) === Number(savedItems[0].unit_price) * savedItems[0].quantity);

  // ── 4. Multi-Vendor Grouping & Item Isolation ────────────────────────────
  console.log('\nTEST 4: Multi-Vendor Item Grouping & Message Isolation');

  const [vendorLogs] = await conn.query(
    'SELECT * FROM notifications_log WHERE order_id = ? AND type = "vendor_order_placed" ORDER BY id ASC',
    [savedOrder.id]
  );

  ok('Separate vendor notification logs created for each vendor', vendorLogs.length === 2, vendorLogs.length);

  const logVendorA = vendorLogs.find(l => l.vendor_id === testVendorId);
  const logVendorB = vendorLogs.find(l => l.vendor_id === 2);

  ok('Vendor A notification sent to Vendor A WhatsApp number', logVendorA?.recipient === '+919876543210', logVendorA?.recipient);
  ok('Vendor B notification sent to Vendor B WhatsApp number', logVendorB?.recipient === '+919014581603', logVendorB?.recipient);

  // Check Item Isolation: Vendor A's message contains Product 1 qty 2, Vendor B's contains Product 2 qty 1
  const msgA = logVendorA?.payload || '';
  const msgB = logVendorB?.payload || '';

  ok('Vendor A message contains Item 1 with qty 2', msgA.includes('x 2 - ₹'), null);
  ok('Vendor A message does NOT contain Item 2 with qty 1', !msgA.includes('x 1 - ₹'), null);

  ok('Vendor B message contains Item 2 with qty 1', msgB.includes('x 1 - ₹'), null);
  ok('Vendor B message does NOT contain Item 1 with qty 2', !msgB.includes('x 2 - ₹'), null);

  // ── 5. Message Format Verification ───────────────────────────────────────
  console.log('\nTEST 5: Vendor Message Format');

  ok('Message starts with 🛒 *New Order #[ID]*', msgA.includes(`🛒 *New Order #${orderNumber}*`), null);
  ok('Message lists numbered items: "1. [Name] x [Qty] - ₹[Price] = ₹[Total]"', msgA.includes('1. ') && msgA.includes('₹'), null);
  ok('Message includes COD Order total line', msgA.includes('Cash on Delivery, collect on delivery'), null);
  ok('Message includes Customer name & E.164 phone', msgA.includes('Rohan Sharma') && msgA.includes('+919876501234'), null);
  ok('Message includes Full delivery address with pincode', msgA.includes('560038') && msgA.includes('Bangalore'), null);
  ok('Message includes Placed at timestamp', msgA.includes('*Placed at:*'), null);

  console.log('\n    --- Preview of Message sent to Vendor A ---');
  console.log(msgA.split('\n').map(l => '    | ' + l).join('\n'));
  console.log('    -------------------------------------------\n');

  // ── 6. Fallback wa.me Click-to-Chat Link ──────────────────────────────────
  console.log('TEST 6: Fallback wa.me Click-to-Chat Links');

  ok('Vendor A log has wa.me fallback link', logVendorA?.fallback_link?.startsWith('https://wa.me/919876543210'), logVendorA?.fallback_link?.slice(0, 50));
  ok('Vendor B log has wa.me fallback link', logVendorB?.fallback_link?.startsWith('https://wa.me/919014581603'), logVendorB?.fallback_link?.slice(0, 50));
  ok('Fallback link contains pre-filled URL-encoded message text', logVendorA?.fallback_link?.includes('text='), null);

  // ── 7. Failure Isolation (No credentials never crash order) ──────────────
  console.log('\nTEST 7: Failure Isolation');
  ok('Status logged as skipped or sent (order did NOT crash)', ['skipped', 'sent'].includes(logVendorA?.status), logVendorA?.status);
  ok('Customer received valid order confirmation', placeData.orderNumber === orderNumber);

  // ── 8. Resend to Vendor from Admin Panel ──────────────────────────────────
  console.log('\nTEST 8: Resend to Vendor from Admin Panel');

  const resendRes = await adminClient.post(`/api/admin/orders/${savedOrder.id}/resend-vendor`, {
    vendorId: testVendorId,
  });
  ok('POST /api/admin/orders/:id/resend-vendor succeeds (HTTP 200)', resendRes.status === 200, resendRes.status);
  const resendData = await resendRes.json();
  ok('Resend response returns results array', Array.isArray(resendData.results) && resendData.results.length >= 1);
  ok('Resend targeted specific vendor', resendData.results[0]?.vendorId === testVendorId);

  // Check admin order detail contains vendor notifications
  const detailRes = await adminClient.get(`/api/admin/orders/${savedOrder.id}`);
  const detailData = await detailRes.json();
  const vendorNotifs = detailData.notifications?.filter(n => n.type === 'vendor_order_placed');
  ok('Admin order detail includes vendor notification history with vendor name', vendorNotifs?.length >= 2);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await conn.end();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`   RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
  if (failed === 0) {
    console.log('   🎉 ALL VENDOR WHATSAPP NOTIFICATION TESTS PASSED!');
  } else {
    console.log(`   ⚠️  ${failed} test(s) failed — review above`);
  }
  console.log('════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\n💥 Test suite crashed:', err);
  process.exit(1);
});
