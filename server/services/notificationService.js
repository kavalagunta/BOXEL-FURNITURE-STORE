import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { env } from '../config/env.js';
import { getSettings } from './settingsService.js';
import { sendLoggedEmail } from './emailService.js';
import * as T from './emailTemplates.js';
import {
  sendWhatsAppMessage,
  sendWhatsAppNotification,
  sendVendorWhatsAppNotification,
  formatCustomerStatusMessage,
  formatOwnerStatusMessage,
  formatE164,
} from './whatsappService.js';
import { HttpError } from '../utils/httpError.js';

export const customMessageSchema = z.object({
  message: z.string().trim().min(2, 'Message cannot be empty').max(2000),
  subject: z.string().trim().max(180).optional(),
});

const adminRecipient = (settings) => settings.admin_notification_email || env.adminEmail || settings.business_email || '';

async function loadOrder(orderId) {
  const order = await queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [orderId]);
  return { order, items };
}

const orderUrlFor = (order) => (order.customer_id ? `${env.clientUrl}/account/orders/${order.order_number}` : null);

/** Renders and sends one order-related email. `logId` re-uses an existing log row (retries). */
export async function sendOrderEmail(type, orderId, { logId = null, customMessage = null, customSubject = null } = {}) {
  const data = await loadOrder(orderId);
  if (!data) throw new HttpError(404, 'Order not found.');
  const { order, items } = data;
  const settings = await getSettings();
  let mail;
  let to;

  if (type === 'order_customer') {
    to = order.customer_email;
    mail = T.orderCustomerEmail({ order, items, settings, orderUrl: orderUrlFor(order) });
  } else if (type === 'order_admin') {
    to = adminRecipient(settings);
    if (!to) return { status: 'skipped', reason: 'No admin email configured' };
    mail = T.orderAdminEmail({ order, items, settings, adminUrl: `${env.clientUrl}/admin/orders/${order.id}` });
  } else if (type === 'order_status') {
    to = order.customer_email;
    mail = T.orderStatusEmail({ order, items, settings, orderUrl: orderUrlFor(order) });
  } else if (type === 'order_feedback' || type === 'order_message') {
    to = order.customer_email;
    mail = T.orderFeedbackEmail({ order, message: customMessage, subject: customSubject, settings, orderUrl: orderUrlFor(order) });
  } else {
    throw new HttpError(400, 'Unknown email type.');
  }

  const result = await sendLoggedEmail({
    type,
    to,
    customerId: order.customer_id || null,
    messageBody: customMessage || null,
    ...mail,
    relatedType: 'order',
    relatedId: order.id,
    logId,
  });

  // Mirror to unified notifications_log table
  try {
    await query(
      `INSERT INTO notifications_log (order_id, channel, recipient, type, status, error, payload, attempts)
       VALUES (?, 'email', ?, ?, ?, ?, ?, 1)`,
      [order.id, to, type, result.status, result.error || null, mail.subject],
    );
  } catch (err) {
    // Non-fatal logging mirror
  }

  return result;
}

/** Called after the order transaction commits. Failures are logged, never thrown. */
export async function notifyOrderPlaced(orderId) {
  try {
    const data = await loadOrder(orderId);
    if (data) {
      // 1. WhatsApp to shop owner
      await sendWhatsAppNotification(data);
      // 2. WhatsApp to delivery vendor(s) (multi-vendor grouping, COD orders)
      if (data.order.payment_method === 'cod' || !data.order.payment_method) {
        await sendVendorWhatsAppNotification(data);
      }
    }
  } catch (err) {
    console.error(`[notify] order ${orderId} WhatsApp failed:`, err.message);
  }

  try {
    await sendOrderEmail('order_customer', orderId);
    await sendOrderEmail('order_admin', orderId);
  } catch (err) {
    console.error(`[notify] order ${orderId} emails failed:`, err.message);
  }
}

/** Resends vendor WhatsApp notification manually from admin panel */
export async function resendVendorWhatsAppNotification(orderId, vendorId = null) {
  const data = await loadOrder(orderId);
  if (!data) throw new HttpError(404, 'Order not found.');
  return await sendVendorWhatsAppNotification({ ...data, targetVendorId: vendorId });
}

/**
 * Triggers status change notifications asynchronously:
 * 1. Customer HTML email (Accepted / Rejected / Shipped / etc.)
 * 2. Customer WhatsApp message (phone from order formatted to E.164)
 * 3. Shop owner WhatsApp alert (+918310018733)
 */
export async function notifyOrderStatus(orderId, { status, reason, admin } = {}) {
  const data = await loadOrder(orderId);
  if (!data) return;
  const { order, items } = data;
  const currentStatus = status || order.status;
  const currentReason = reason || order.rejection_reason || order.cancel_reason;

  // 1. Customer Email
  try {
    await sendOrderEmail('order_status', orderId);
  } catch (err) {
    console.error(`[notify] order ${orderId} customer status email failed:`, err.message);
  }

  // 2. Customer WhatsApp message
  try {
    const custMsg = formatCustomerStatusMessage({ order, status: currentStatus, reason: currentReason });
    await sendWhatsAppMessage({
      to: order.customer_phone,
      message: custMsg,
      orderId: order.id,
      type: `customer_order_${currentStatus}`,
    });
  } catch (err) {
    console.error(`[notify] order ${orderId} customer WhatsApp failed:`, err.message);
  }

  // 3. Shop Owner WhatsApp alert
  try {
    const settings = await getSettings();
    const ownerPhone = env.whatsapp?.recipientPhone || settings.business_whatsapp || settings.business_phone || '+918310018733';
    const ownerMsg = formatOwnerStatusMessage({ order, status: currentStatus, reason: currentReason });
    await sendWhatsAppMessage({
      to: ownerPhone,
      message: ownerMsg,
      orderId: order.id,
      type: `owner_order_${currentStatus}`,
    });
  } catch (err) {
    console.error(`[notify] order ${orderId} owner WhatsApp alert failed:`, err.message);
  }
}

export async function sendCustomerOrderFeedback({ orderId, admin, message, subject }) {
  const data = await loadOrder(orderId);
  if (!data) throw new HttpError(404, 'Order not found.');
  const { order } = data;

  // 1. Record feedback in internal notes so it displays in order timeline
  await query('INSERT INTO order_internal_notes (order_id, admin_id, note) VALUES (?, ?, ?)', [
    orderId,
    admin.id,
    `Message to customer: "${message}"`,
  ]);

  // 2. Dispatch email notification
  const emailResult = await sendOrderEmail('order_feedback', orderId, {
    customMessage: message,
    customSubject: subject,
  });

  // 3. Also send feedback on customer WhatsApp
  try {
    const feedbackMsg = `Hi ${order.customer_name}, store update regarding your order #${order.order_number}:\n\n"${message}"\n\nQuestions? Feel free to reply.`;
    await sendWhatsAppMessage({
      to: order.customer_phone,
      message: feedbackMsg,
      orderId: order.id,
      type: 'customer_order_feedback',
    });
  } catch (err) {
    console.error('[notify] feedback WhatsApp error:', err.message);
  }

  return { ok: true, email: emailResult };
}

async function sendEnquiryEmail(type, enquiryId, { logId = null } = {}) {
  const enquiry = await queryOne('SELECT * FROM enquiries WHERE id = ?', [enquiryId]);
  if (!enquiry) throw new HttpError(404, 'Enquiry not found.');
  const settings = await getSettings();
  if (type === 'enquiry_admin') {
    const to = adminRecipient(settings);
    if (!to) return { status: 'skipped', reason: 'No admin email configured' };
    const mail = T.enquiryAdminEmail({ enquiry, settings, adminUrl: `${env.clientUrl}/admin/enquiries?open=${enquiry.id}` });
    return sendLoggedEmail({ type, to, ...mail, relatedType: 'enquiry', relatedId: enquiry.id, logId });
  }
  if (type === 'enquiry_ack') {
    const mail = T.enquiryAckEmail({ enquiry, settings });
    return sendLoggedEmail({ type, to: enquiry.email, ...mail, relatedType: 'enquiry', relatedId: enquiry.id, logId });
  }
  throw new HttpError(400, 'Unknown email type.');
}

export async function notifyEnquiry(enquiryId) {
  try {
    await sendEnquiryEmail('enquiry_admin', enquiryId);
    await sendEnquiryEmail('enquiry_ack', enquiryId);
  } catch (err) {
    console.error(`[notify] enquiry ${enquiryId} emails failed:`, err.message);
  }
}

export async function notifyNewsletter(email) {
  try {
    const settings = await getSettings();
    const to = adminRecipient(settings);
    if (!to) return;
    const mail = T.newsletterAdminEmail({ email, settings });
    await sendLoggedEmail({ type: 'newsletter_admin', to, ...mail });
  } catch (err) {
    console.error('[notify] newsletter alert failed:', err.message);
  }
}

export async function sendTestEmail(to) {
  const settings = await getSettings();
  const mail = T.testEmail({ settings });
  return sendLoggedEmail({ type: 'test', to, ...mail });
}

export async function sendEnquiryReply({ enquiry, replyText, admin }) {
  const settings = await getSettings();
  const mail = T.enquiryReplyEmail({ enquiry, replyText, settings });
  return sendLoggedEmail({
    type: 'enquiry_reply',
    to: enquiry.email,
    messageBody: replyText,
    ...mail,
    relatedType: 'enquiry',
    relatedId: enquiry.id,
  });
}

export async function sendPasswordReset(customer, link) {
  const settings = await getSettings();
  const mail = T.passwordResetEmail({ name: customer.name, link, settings });
  return sendLoggedEmail({
    type: 'password_reset',
    to: customer.email,
    customerId: customer.id,
    ...mail,
    relatedType: 'customer',
    relatedId: customer.id,
  });
}

export async function retryEmail(logId) {
  const row = await queryOne('SELECT * FROM email_notification_logs WHERE id = ?', [logId]);
  if (!row) throw new HttpError(404, 'Email log not found.');
  if (row.status === 'sent') throw new HttpError(409, 'This email has already been sent.');

  if (row.type.startsWith('order_')) {
    if (row.type === 'order_feedback' || row.type === 'order_message') {
      return sendOrderEmail(row.type, row.related_id, {
        logId: row.id,
        customMessage: row.message_body,
        customSubject: row.subject,
      });
    }
    return sendOrderEmail(row.type, row.related_id, { logId: row.id });
  }
  if (row.type.startsWith('enquiry_')) return sendEnquiryEmail(row.type, row.related_id, { logId: row.id });
  throw new HttpError(400, 'This notification type cannot be retried automatically.');
}

export async function retryNotificationLog(notificationId) {
  const notif = await queryOne('SELECT * FROM notifications_log WHERE id = ?', [notificationId]);
  if (!notif) throw new HttpError(404, 'Notification log not found.');

  if (notif.channel === 'whatsapp') {
    const res = await sendWhatsAppMessage({
      to: notif.recipient,
      message: notif.payload,
      orderId: notif.order_id,
      type: notif.type,
    });
    await query(
      'UPDATE notifications_log SET status = ?, error = ?, fallback_link = ?, attempts = attempts + 1 WHERE id = ?',
      [res.status, res.error || null, res.fallbackLink || null, notificationId],
    );
    return res;
  }

  if (notif.channel === 'email') {
    return sendOrderEmail(notif.type, notif.order_id);
  }

  throw new HttpError(400, 'Unsupported notification channel');
}
