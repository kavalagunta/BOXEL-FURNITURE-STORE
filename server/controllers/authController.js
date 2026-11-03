import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { regenerateSession } from '../middleware/auth.js';
import { email, password, text, optionalPhone } from '../utils/validators.js';
import { sha256 } from '../utils/helpers.js';
import { HttpError, conflict, unauthorized } from '../utils/httpError.js';
import { sendPasswordReset } from '../services/notificationService.js';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Used to keep response timing similar whether or not an email exists.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', BCRYPT_ROUNDS);

export const registerSchema = z.object({
  name: text(120, 2),
  email,
  phone: optionalPhone,
  password,
});
export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.').max(128) });
export const profileSchema = z.object({ name: text(120, 2), phone: optionalPhone });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is invalid.'), password });

const publicCustomer = (c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone });

/**
 * Shared credential check for customers and admins with lockout after repeated failures.
 * Always returns the same generic error so it does not reveal which part was wrong.
 */
export async function verifyCredentials(table, emailAddress, plain) {
  const user = await queryOne(`SELECT * FROM ${table} WHERE email = ?`, [emailAddress]);
  const generic = unauthorized('Email or password is incorrect.');
  if (!user) {
    await bcrypt.compare(plain, DUMMY_HASH);
    throw generic;
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await bcrypt.compare(plain, DUMMY_HASH);
    throw new HttpError(429, `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
  }
  const ok = await bcrypt.compare(plain, user.password_hash);
  if (!ok) {
    const attempts = user.failed_login_attempts + 1;
    if (attempts >= MAX_FAILED) {
      await query(`UPDATE ${table} SET failed_login_attempts = 0, locked_until = UTC_TIMESTAMP() + INTERVAL ? MINUTE WHERE id = ?`, [LOCK_MINUTES, user.id]);
    } else {
      await query(`UPDATE ${table} SET failed_login_attempts = ? WHERE id = ?`, [attempts, user.id]);
    }
    throw generic;
  }
  if (!user.is_active) throw new HttpError(403, 'This account is disabled. Please contact us.');
  await query(`UPDATE ${table} SET failed_login_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?`, [user.id]);
  return user;
}

export async function register(req, res) {
  const d = req.valid.body;
  const exists = await queryOne('SELECT id FROM customers WHERE email = ?', [d.email]);
  if (exists) throw conflict('An account with this email already exists. Sign in instead.', { fields: { email: 'This email is already registered.' } });
  const hash = await bcrypt.hash(d.password, BCRYPT_ROUNDS);
  const result = await query('INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)', [d.name, d.email, d.phone, hash]);
  req.session.customerId = result.insertId;
  await regenerateSession(req);
  res.status(201).json({ customer: { id: result.insertId, name: d.name, email: d.email, phone: d.phone } });
}

export async function login(req, res) {
  const { email: e, password: pw } = req.valid.body;
  const user = await verifyCredentials('customers', e, pw);
  req.session.customerId = user.id;
  await regenerateSession(req);
  res.json({ customer: publicCustomer(user) });
}

export async function logout(req, res) {
  delete req.session.customerId;
  await regenerateSession(req);
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ customer: req.customer ? publicCustomer(req.customer) : null });
}

export async function updateProfile(req, res) {
  const d = req.valid.body;
  await query('UPDATE customers SET name = ?, phone = ? WHERE id = ?', [d.name, d.phone, req.customer.id]);
  res.json({ customer: { ...publicCustomer(req.customer), name: d.name, phone: d.phone } });
}

export async function changePassword(req, res) {
  const d = req.valid.body;
  const row = await queryOne('SELECT password_hash FROM customers WHERE id = ?', [req.customer.id]);
  if (!(await bcrypt.compare(d.currentPassword, row.password_hash))) {
    throw new HttpError(422, 'Your current password is incorrect.', { fields: { currentPassword: 'Incorrect password.' } });
  }
  await query('UPDATE customers SET password_hash = ? WHERE id = ?', [await bcrypt.hash(d.newPassword, BCRYPT_ROUNDS), req.customer.id]);
  await regenerateSession(req);
  res.json({ message: 'Password updated.' });
}

/** Always answers the same way, so it cannot be used to discover registered emails. */
export async function forgotPassword(req, res) {
  const customer = await queryOne('SELECT id, name, email, is_active FROM customers WHERE email = ?', [req.valid.body.email]);
  if (customer?.is_active) {
    const token = crypto.randomBytes(32).toString('hex');
    await query('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE customer_id = ? AND used_at IS NULL', [customer.id]);
    await query('INSERT INTO password_reset_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 60 MINUTE)', [customer.id, sha256(token)]);
    const link = `${env.clientUrl}/reset-password?token=${token}`;
    setImmediate(() => sendPasswordReset(customer, link).catch((err) => console.error('[auth] reset email failed', err.message)));
  }
  res.json({ message: 'If an account exists for this email, we have sent a link to reset the password.' });
}

export async function resetPassword(req, res) {
  const { token, password: pw } = req.valid.body;
  const hash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
  await withTransaction(async (conn) => {
    const [[row]] = await conn.query(
      'SELECT id, customer_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
      [sha256(token)],
    );
    if (!row) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
    await conn.query('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [row.id]);
    await conn.query('UPDATE customers SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [hash, row.customer_id]);
  });
  res.json({ message: 'Your password has been reset. You can now sign in.' });
}
