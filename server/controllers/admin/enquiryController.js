import { z } from 'zod';
import { query, queryOne } from '../../config/db.js';
import { logActivity } from '../../services/activityLog.js';
import { sendEnquiryReply } from '../../services/notificationService.js';
import { smtpConfigured } from '../../services/emailService.js';
import { pagination, pageMeta, likeTerm } from '../../utils/helpers.js';
import { text, optionalText } from '../../utils/validators.js';
import { HttpError, notFound } from '../../utils/httpError.js';

const STATUSES = ['new', 'read', 'in_progress', 'resolved'];
export const enquiryUpdateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  internal_notes: optionalText(5000).optional(),
});
export const replySchema = z.object({ message: text(5000, 5) });

export async function list(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20 });
  const where = [];
  const params = [];
  if (STATUSES.includes(req.query.status)) {
    where.push('status = ?');
    params.push(req.query.status);
  }
  if (req.query.q) {
    const like = likeTerm(req.query.q);
    where.push('(reference LIKE ? OR name LIKE ? OR email LIKE ? OR message LIKE ?)');
    params.push(like, like, like, like);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM enquiries ${w}`, params);
  const items = await query(
    `SELECT id, reference, topic, name, email, phone, status, created_at, LEFT(message, 160) AS excerpt FROM enquiries ${w}
      ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  res.json({ items, meta: pageMeta(page, limit, total) });
}

/** Opening an enquiry marks it as read. */
export async function get(req, res) {
  const row = await queryOne('SELECT * FROM enquiries WHERE id = ?', [req.params.id]);
  if (!row) throw notFound('Enquiry not found.');
  if (row.status === 'new') {
    await query("UPDATE enquiries SET status = 'read' WHERE id = ?", [row.id]);
    row.status = 'read';
  }
  const emails = await query(
    "SELECT id, type, recipient, status, error_message, created_at, sent_at FROM email_notification_logs WHERE related_type = 'enquiry' AND related_id = ? ORDER BY id DESC",
    [row.id],
  );
  delete row.ip_address;
  res.json({ enquiry: row, emails, canReply: smtpConfigured() });
}

export async function update(req, res) {
  const id = Number(req.params.id);
  const row = await queryOne('SELECT id, status FROM enquiries WHERE id = ?', [id]);
  if (!row) throw notFound('Enquiry not found.');
  const d = req.valid.body;
  const sets = [];
  const params = [];
  if (d.status) { sets.push('status = ?'); params.push(d.status); }
  if (d.internal_notes !== undefined) { sets.push('internal_notes = ?'); params.push(d.internal_notes); }
  if (!sets.length) return res.json({ ok: true });
  await query(`UPDATE enquiries SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  await logActivity(req, 'enquiry.update', 'enquiry', id, { status: d.status ? { from: row.status, to: d.status } : undefined, notes: d.internal_notes !== undefined || undefined });
  res.json({ ok: true });
}

export async function reply(req, res) {
  const id = Number(req.params.id);
  const enquiry = await queryOne('SELECT * FROM enquiries WHERE id = ?', [id]);
  if (!enquiry) throw notFound('Enquiry not found.');
  if (!smtpConfigured()) throw new HttpError(503, 'SMTP is not configured, so replies cannot be sent from here.');
  const result = await sendEnquiryReply(enquiry, req.valid.body.message);
  if (result.status !== 'sent') throw new HttpError(502, `The reply could not be sent: ${result.error || result.status}.`);
  if (enquiry.status !== 'resolved') await query("UPDATE enquiries SET status = 'in_progress' WHERE id = ? AND status IN ('new','read')", [id]);
  await logActivity(req, 'enquiry.reply', 'enquiry', id);
  res.json({ ok: true });
}

export async function newsletter(req, res) {
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM newsletter_subscribers');
  const items = await query('SELECT id, email, status, consent_at, created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  res.json({ items, meta: pageMeta(page, limit, total) });
}

export async function removeSubscriber(req, res) {
  const id = Number(req.params.id);
  const row = await queryOne('SELECT email FROM newsletter_subscribers WHERE id = ?', [id]);
  if (!row) throw notFound('Subscriber not found.');
  await query('DELETE FROM newsletter_subscribers WHERE id = ?', [id]);
  await logActivity(req, 'newsletter.delete', 'newsletter', id, { email: row.email });
  res.json({ ok: true });
}
