import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../../config/db.js';
import { logActivity } from '../../services/activityLog.js';
import { smtpSummary, verifySmtp } from '../../services/emailService.js';
import { sendTestEmail, retryEmail } from '../../services/notificationService.js';
import { pagination, pageMeta, parseJson } from '../../utils/helpers.js';
import { email, password, text } from '../../utils/validators.js';
import { HttpError, notFound, conflict } from '../../utils/httpError.js';

// ---------------- Email ----------------
export async function emailStatus(_req, res) {
  const counts = await query('SELECT status, COUNT(*) AS n FROM email_notification_logs GROUP BY status');
  res.json({ smtp: smtpSummary(), counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) });
}

export async function emailLogs(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 25 });
  const where = [];
  const params = [];
  if (['pending', 'sent', 'failed', 'skipped'].includes(req.query.status)) {
    where.push('l.status = ?');
    params.push(req.query.status);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM email_notification_logs l ${w}`, params);
  const items = await query(
    `SELECT l.*, o.order_number, e.reference AS enquiry_reference FROM email_notification_logs l
       LEFT JOIN orders o ON l.related_type = 'order' AND o.id = l.related_id
       LEFT JOIN enquiries e ON l.related_type = 'enquiry' AND e.id = l.related_id
       ${w} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  res.json({ items, meta: pageMeta(page, limit, total) });
}

export const testEmailSchema = z.object({ to: email });

export async function testEmail(req, res) {
  const ok = await verifySmtp();
  if (!ok) throw new HttpError(503, 'Could not connect to the SMTP server. Check the SMTP settings in server/.env and the server log.');
  const result = await sendTestEmail(req.valid.body.to);
  await logActivity(req, 'email.test', 'email', result.logId, { to: req.valid.body.to, status: result.status });
  if (result.status !== 'sent') throw new HttpError(502, `Test email failed: ${result.error || result.status}`);
  res.json({ ok: true });
}

export async function retry(req, res) {
  const result = await retryEmail(Number(req.params.id));
  await logActivity(req, 'email.retry', 'email', req.params.id, { status: result.status });
  res.json(result);
}

// ---------------- Admin users (super_admin only) ----------------
export const adminCreateSchema = z.object({
  name: text(120, 2),
  email,
  role: z.enum(['super_admin', 'admin', 'support']),
  password,
});
export const adminUpdateSchema = z.object({
  name: text(120, 2),
  role: z.enum(['super_admin', 'admin', 'support']),
  is_active: z.boolean(),
  password: z.union([password, z.literal('')]).optional(),
});

export async function listAdmins(_req, res) {
  const items = await query('SELECT id, name, email, role, is_active, last_login_at, created_at FROM admins ORDER BY created_at');
  res.json({ items: items.map((a) => ({ ...a, is_active: Boolean(a.is_active) })) });
}

export async function createAdmin(req, res) {
  const d = req.valid.body;
  if (await queryOne('SELECT id FROM admins WHERE email = ?', [d.email])) throw conflict('An admin with this email already exists.', { fields: { email: 'Already in use.' } });
  const r = await query('INSERT INTO admins (name, email, role, password_hash) VALUES (?, ?, ?, ?)', [d.name, d.email, d.role, await bcrypt.hash(d.password, 12)]);
  await logActivity(req, 'admin.create', 'admin', r.insertId, { email: d.email, role: d.role });
  res.status(201).json({ id: r.insertId });
}

export async function updateAdmin(req, res) {
  const id = Number(req.params.id);
  const d = req.valid.body;
  const target = await queryOne('SELECT id, role, is_active, email FROM admins WHERE id = ?', [id]);
  if (!target) throw notFound('Admin not found.');
  if (id === req.admin.id && (!d.is_active || d.role !== 'super_admin')) {
    throw new HttpError(422, 'You cannot disable or demote your own account.');
  }
  // Never leave the store without an active super admin.
  if (target.role === 'super_admin' && (d.role !== 'super_admin' || !d.is_active)) {
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM admins WHERE role = 'super_admin' AND is_active = 1 AND id <> ?", [id]);
    if (Number(n) === 0) throw new HttpError(422, 'At least one active super admin is required.');
  }
  await query('UPDATE admins SET name = ?, role = ?, is_active = ? WHERE id = ?', [d.name, d.role, d.is_active ? 1 : 0, id]);
  if (d.password) await query('UPDATE admins SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [await bcrypt.hash(d.password, 12), id]);
  await logActivity(req, 'admin.update', 'admin', id, { email: target.email, role: d.role, is_active: d.is_active, passwordChanged: Boolean(d.password) });
  res.json({ ok: true });
}

// ---------------- Activity log ----------------
export async function activity(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 30 });
  const where = [];
  const params = [];
  if (req.query.entity) {
    where.push('l.entity_type = ?');
    params.push(String(req.query.entity).slice(0, 40));
  }
  if (req.query.admin) {
    where.push('l.admin_id = ?');
    params.push(Number(req.query.admin) || 0);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM admin_activity_logs l ${w}`, params);
  const items = await query(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.ip_address, l.created_at, a.name AS admin_name, a.email AS admin_email
       FROM admin_activity_logs l LEFT JOIN admins a ON a.id = l.admin_id ${w} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  res.json({ items: items.map((i) => ({ ...i, details: parseJson(i.details, null) })), meta: pageMeta(page, limit, total) });
}
