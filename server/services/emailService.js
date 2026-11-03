import path from 'node:path';
import nodemailer from 'nodemailer';
import { env, SERVER_ROOT } from '../config/env.js';
import { query } from '../config/db.js';

const LOGO_PATH = path.join(SERVER_ROOT, 'assets', 'boxel-logo-email.png');
let transporter = null;

export function smtpConfigured() {
  return Boolean(env.smtp.host && env.smtp.fromEmail);
}

/** Safe description of the SMTP setup for logs and the admin panel — never includes the password. */
export function smtpSummary() {
  return {
    configured: smtpConfigured(),
    host: env.smtp.host || null,
    port: env.smtp.port,
    secure: env.smtp.secure,
    user: env.smtp.user ? env.smtp.user.replace(/^(.{2}).*(@.*)?$/, (_m, a, b) => `${a}•••${b || ''}`) : null,
    fromName: env.smtp.fromName,
    fromEmail: env.smtp.fromEmail || null,
    adminEmail: env.adminEmail || null,
  };
}

function getTransporter() {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export async function verifySmtp() {
  if (!smtpConfigured()) {
    console.warn('[smtp] Not configured (SMTP_HOST / SMTP_FROM_EMAIL empty). Emails will be logged as "skipped".');
    return false;
  }
  try {
    await getTransporter().verify();
    console.log(`[smtp] Connected to ${env.smtp.host}:${env.smtp.port} as ${smtpSummary().user || '(no auth)'}`);
    return true;
  } catch (err) {
    console.error(`[smtp] Could not connect to ${env.smtp.host}:${env.smtp.port} — ${safeError(err)}`);
    return false;
  }
}

function safeError(err) {
  let msg = String(err?.message || err || 'Unknown error');
  if (env.smtp.password) msg = msg.split(env.smtp.password).join('•••');
  return msg.slice(0, 480);
}

/**
 * Sends one email and records the outcome in email_notification_logs.
 * Pass `logId` to retry an existing log row. Never throws.
 */
export async function sendLoggedEmail({ type, to, subject, html, text, customerId = null, messageBody = null, relatedType = null, relatedId = null, logId = null }) {
  if (!logId) {
    const result = await query(
      'INSERT INTO email_notification_logs (type, recipient, customer_id, subject, message_body, related_type, related_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [type, to, customerId, subject.slice(0, 255), messageBody, relatedType, relatedId, 'pending'],
    );
    logId = result.insertId;
  }

  const t = getTransporter();
  if (!t) {
    await query(
      "UPDATE email_notification_logs SET status = 'skipped', error_message = ?, last_attempt_at = UTC_TIMESTAMP() WHERE id = ?",
      ['SMTP is not configured in server/.env (SMTP_HOST / SMTP_FROM_EMAIL).', logId],
    );
    console.log(`[email:simulation] Email to ${to} [${subject}] logged as skipped (configure SMTP in server/.env to send real mail)`);
    return { status: 'skipped', logId, error: 'SMTP is not configured.' };
  }

  try {
    const info = await t.sendMail({
      from: { name: env.smtp.fromName || 'boxel', address: env.smtp.fromEmail },
      to,
      subject,
      html,
      text,
      attachments: [{ filename: 'boxel-logo.png', path: LOGO_PATH, cid: 'boxel-logo' }],
    });
    const messageId = info?.messageId || null;
    await query(
      "UPDATE email_notification_logs SET status = 'sent', provider_message_id = ?, error_message = NULL, attempts = attempts + 1, last_attempt_at = UTC_TIMESTAMP(), sent_at = UTC_TIMESTAMP() WHERE id = ?",
      [messageId, logId],
    );
    return { status: 'sent', logId, messageId };
  } catch (err) {
    const message = safeError(err);
    console.error(`[smtp] Failed to send "${type}" email (log #${logId}): ${message}`);
    await query(
      "UPDATE email_notification_logs SET status = 'failed', error_message = ?, attempts = attempts + 1, last_attempt_at = UTC_TIMESTAMP() WHERE id = ?",
      [message, logId],
    );
    return { status: 'failed', logId, error: message };
  }
}
