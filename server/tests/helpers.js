process.env.NODE_ENV = 'test';

import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const { createApp } = await import('../app.js');
export const db = await import('../config/db.js');
const { invalidateSettings } = await import('../services/settingsService.js');

export const app = createApp({ sessionStore: new session.MemoryStore() });

/** A cookie-keeping client that automatically sends the CSRF token. */
export async function client() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf');
  const token = res.body.csrfToken;
  const wrap = (method) => (url) => agent[method](url).set('X-CSRF-Token', token);
  return { agent, token, get: (url) => agent.get(url), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete') };
}

export async function createAdminUser({ email, role = 'super_admin', password = 'TestAdmin12345' }) {
  const hash = await bcrypt.hash(password, 4);
  await db.query('DELETE FROM admins WHERE email = ?', [email]);
  await db.query('INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [`Test ${role}`, email, hash, role]);
  return { email, password };
}

export async function adminClient(role = 'super_admin') {
  const creds = await createAdminUser({ email: `${role}@test.boxel`, role });
  const c = await client();
  const res = await c.post('/api/admin/auth/login').send(creds);
  if (res.status !== 200) throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}

export async function setSetting(key, value) {
  await db.query('UPDATE store_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
  invalidateSettings();
}

export const uuid = () => crypto.randomUUID();

export const validCheckout = (overrides = {}) => ({
  idempotencyKey: uuid(),
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+91 98450 12345',
  line1: '12, 4th Cross, Indiranagar',
  line2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560 038',
  paymentMethod: 'cod',
  items: [{ variantId: 1, quantity: 2 }],
  ...overrides,
});
