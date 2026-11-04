import { escapeHtml as e, formatINR } from '../utils/helpers.js';

const C = { ink: '#171717', muted: '#707070', line: '#E8E8E5', stone: '#F7F7F5', orange: '#F17E00' };

const PAYMENT_LABELS = { cod: 'Cash on delivery', bank_transfer: 'Pay on confirmation', online: 'Online payment' };
const PAYMENT_STATUS = { pending: 'Awaiting payment', paid: 'Paid', failed: 'Failed', refunded: 'Refunded', cancelled: 'Cancelled' };
const ORDER_STATUS = {
  placed: 'Legacy placed',
  pending: 'Pending',
  accepted: 'Accepted',
  confirmed: 'Accepted',
  processing: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const paymentLabel = (m) => PAYMENT_LABELS[m] || m;
export const paymentStatusLabel = (s) => PAYMENT_STATUS[s] || s;
export const orderStatusLabel = (s) => ORDER_STATUS[s] || s;

const fmtDate = (d) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(d));

const prettyPhone = (p) => {
  const m = String(p || '').match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
};

/** Table-based responsive shell that renders consistently in Gmail, Outlook and Apple Mail. */
function layout({ preheader, body, settings }) {
  const phone = prettyPhone(settings.business_phone);
  const email = settings.business_email;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${e(settings.business_name || 'boxel')}</title></head>
<body style="margin:0;padding:0;background:${C.stone};-webkit-text-size-adjust:100%;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.stone};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line};">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid ${C.line};">
<img src="cid:boxel-logo" width="120" alt="boxel" style="display:block;width:120px;height:auto;border:0;">
</td></tr>
<tr><td style="padding:32px;font-family:Helvetica,Arial,sans-serif;color:${C.ink};font-size:15px;line-height:1.6;">
${body}
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid ${C.line};font-family:Helvetica,Arial,sans-serif;color:${C.muted};font-size:13px;line-height:1.6;">
Questions? Call or WhatsApp ${e(phone)}${email ? ` or write to <a href="mailto:${e(email)}" style="color:${C.ink};">${e(email)}</a>` : ''}.<br>
${e(settings.business_name || 'boxel')} — ${e(settings.business_tagline || 'Smart. Safe. Simple.')}
</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = (t) => `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:600;color:${C.ink};">${e(t)}</h1>`;
const p = (t) => `<p style="margin:0 0 16px;">${t}</p>`;
const label = (t) => `<div style="font-size:12px;color:${C.muted};margin:0 0 4px;">${e(t)}</div>`;

function itemsTable(items) {
  const rows = items
    .map(
      (i) => `<tr>
<td style="padding:12px 0;border-bottom:1px solid ${C.line};vertical-align:top;">
<strong style="font-weight:600;">${e(i.product_name)}</strong><br>
<span style="color:${C.muted};font-size:13px;">${i.variant_name ? `Colour: ${e(i.variant_name)} · ` : ''}Qty ${i.quantity} × ${formatINR(i.unit_price)}</span>
</td>
<td align="right" style="padding:12px 0;border-bottom:1px solid ${C.line};vertical-align:top;white-space:nowrap;">${formatINR(i.line_total)}</td>
</tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">${rows}</table>`;
}

function totalsTable(order) {
  const row = (k, v, strong = false) =>
    `<tr><td style="padding:4px 0;${strong ? 'font-weight:600;font-size:16px;' : `color:${C.muted};`}">${e(k)}</td><td align="right" style="padding:4px 0;${strong ? 'font-weight:600;font-size:16px;' : ''}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
${row('Subtotal', formatINR(order.subtotal))}
${row('Shipping', Number(order.shipping_fee) > 0 ? formatINR(order.shipping_fee) : 'Free')}
${Number(order.tax_amount) > 0 ? row(order.tax_label || 'Tax', formatINR(order.tax_amount)) : ''}
${row('Total', formatINR(order.total), true)}
</table>`;
}

function addressBlock(o) {
  return [o.customer_name, o.ship_line1, o.ship_line2, `${o.ship_city}, ${o.ship_state} ${o.ship_pincode}`, o.ship_country, prettyPhone(o.customer_phone)]
    .filter(Boolean)
    .map(e)
    .join('<br>');
}

function addressText(o) {
  return [o.customer_name, o.ship_line1, o.ship_line2, `${o.ship_city}, ${o.ship_state} ${o.ship_pincode}`, o.ship_country, prettyPhone(o.customer_phone)]
    .filter(Boolean)
    .join('\n');
}

function itemsText(items) {
  return items.map((i) => `- ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity} — ${formatINR(i.line_total)}`).join('\n');
}

function totalsText(o) {
  return [
    `Subtotal: ${formatINR(o.subtotal)}`,
    `Shipping: ${Number(o.shipping_fee) > 0 ? formatINR(o.shipping_fee) : 'Free'}`,
    Number(o.tax_amount) > 0 ? `${o.tax_label || 'Tax'}: ${formatINR(o.tax_amount)}` : null,
    `Total: ${formatINR(o.total)}`,
  ].filter(Boolean).join('\n');
}

// 1 — customer order confirmation
export function orderCustomerEmail({ order, items, settings, orderUrl }) {
  const subject = `Your boxel order ${order.order_number} is received`;
  const payment = `${paymentLabel(order.payment_method)} — ${paymentStatusLabel(order.payment_status)}`;
  const body = `${h1('Thank you for your order')}
${p(`Hi ${e(order.customer_name)}, we have received your order <strong>${e(order.order_number)}</strong> placed on ${e(fmtDate(order.created_at))}.`)}
${p('Every boxel product is made to order. We will confirm your order and expected dispatch date, and share a video of your product’s quality and functions before it ships.')}
${itemsTable(items)}
${totalsTable(order)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding:0 12px 16px 0;width:50%;">${label('Delivery address')}${addressBlock(order)}</td>
<td style="vertical-align:top;padding:0 0 16px;width:50%;">${label('Payment')}${e(payment)}</td>
</tr></table>
${order.payment_method === 'bank_transfer' && settings.bank_transfer_instructions ? p(e(settings.bank_transfer_instructions)) : ''}
${orderUrl ? `<p style="margin:8px 0 0;"><a href="${e(orderUrl)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">View your order</a></p>` : ''}`;
  const text = `Thank you for your order\n\nOrder ${order.order_number} — placed ${fmtDate(order.created_at)}\n\n${itemsText(items)}\n\n${totalsText(order)}\n\nDelivery address:\n${addressText(order)}\n\nPayment: ${payment}\n${order.payment_method === 'bank_transfer' ? `\n${settings.bank_transfer_instructions || ''}\n` : ''}\nEvery boxel product is made to order. We will confirm your order and share a quality-check video before dispatch.\n${orderUrl ? `\nView your order: ${orderUrl}\n` : ''}\nQuestions? Call or WhatsApp ${prettyPhone(settings.business_phone)}.`;
  return { subject, html: layout({ preheader: `Order ${order.order_number} received`, body, settings }), text };
}

// 2 — admin new-order notification
export function orderAdminEmail({ order, items, settings, adminUrl }) {
  const subject = `New order ${order.order_number} — ${formatINR(order.total)}`;
  const body = `${h1(`New order ${order.order_number}`)}
${p(`Placed ${e(fmtDate(order.created_at))}.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding:0 12px 16px 0;width:50%;">${label('Customer')}${e(order.customer_name)}<br><a href="mailto:${e(order.customer_email)}" style="color:${C.ink};">${e(order.customer_email)}</a><br>${e(prettyPhone(order.customer_phone))}</td>
<td style="vertical-align:top;padding:0 0 16px;width:50%;">${label('Delivery address')}${addressBlock(order)}</td>
</tr></table>
${order.delivery_instructions ? p(`<strong>Delivery instructions:</strong> ${e(order.delivery_instructions)}`) : ''}
${order.order_notes ? p(`<strong>Order notes:</strong> ${e(order.order_notes)}`) : ''}
${itemsTable(items)}
${totalsTable(order)}
${p(`<strong>Payment:</strong> ${e(paymentLabel(order.payment_method))} — ${e(paymentStatusLabel(order.payment_status))}`)}
<p style="margin:8px 0 0;"><a href="${e(adminUrl)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">Open in admin</a></p>`;
  const text = `New order ${order.order_number}\nPlaced ${fmtDate(order.created_at)}\n\nCustomer: ${order.customer_name}\nEmail: ${order.customer_email}\nPhone: ${prettyPhone(order.customer_phone)}\n\nDelivery address:\n${addressText(order)}\n${order.delivery_instructions ? `\nDelivery instructions: ${order.delivery_instructions}\n` : ''}${order.order_notes ? `Order notes: ${order.order_notes}\n` : ''}\n${itemsText(items)}\n\n${totalsText(order)}\n\nPayment: ${paymentLabel(order.payment_method)} — ${paymentStatusLabel(order.payment_status)}\n\nAdmin: ${adminUrl}`;
  return { subject, html: layout({ preheader: `${order.customer_name} — ${formatINR(order.total)}`, body, settings }), text };
}

// Order status update for the customer (accepted / rejected / shipped / delivered / cancelled …)
export function orderStatusEmail({ order, items = [], settings, orderUrl }) {
  const status = orderStatusLabel(order.status);
  const isAccepted = order.status === 'accepted' || order.status === 'confirmed';
  const isRejected = order.status === 'rejected' || order.status === 'cancelled';
  const reason = order.rejection_reason || order.cancel_reason;
  
  let subject = `Order ${order.order_number}: ${status}`;
  if (isAccepted) subject = `Your boxel order #${order.order_number} has been accepted!`;
  if (isRejected) subject = `Important update regarding your boxel order #${order.order_number}`;

  const tracking = order.tracking_number
    ? `${order.tracking_carrier ? `${order.tracking_carrier} — ` : ''}${order.tracking_number}`
    : null;

  let intro = `Your order status is now: ${status}.`;
  if (isAccepted) {
    intro = `Hi ${order.customer_name}, great news! Your order #${order.order_number} has been accepted for delivery to your address. We are preparing it for dispatch.`;
  } else if (isRejected) {
    intro = `Hi ${order.customer_name}, we regret to inform you that your order #${order.order_number} could not be accepted.`;
  } else if (order.status === 'shipped') {
    intro = `Good news! Your order #${order.order_number} is on its way.`;
  } else if (order.status === 'delivered') {
    intro = `Your order #${order.order_number} has been delivered. We hope you love your new furniture!`;
  } else if (order.status === 'processing') {
    intro = `Your order #${order.order_number} is now in production.`;
  }

  const itemsHtml = items && items.length > 0 ? itemsTable(items) : '';
  const totalsHtml = items && items.length > 0 ? totalsTable(order) : '';

  const rejectionBlock = isRejected && reason
    ? `<div style="margin:16px 0 20px;padding:14px 18px;background:#fbe9e7;border-left:4px solid #a3261b;color:#a3261b;font-size:14px;line-height:1.5;">
         <strong>Reason for rejection:</strong><br>${e(reason)}
       </div>
       <p style="margin:0 0 16px;font-size:13px;color:${C.muted};">Since this was placed with Cash on Delivery (COD), no payment was charged.</p>`
    : '';

  const acceptedDetails = isAccepted
    ? `<div style="margin:16px 0 20px;padding:14px 18px;background:#e7f3ec;border-left:4px solid #1f6b40;color:#1f6b40;font-size:14px;line-height:1.5;">
         <strong>Order Accepted for Delivery</strong><br>
         Expected timeline: 3-5 business days. Our team will verify and package your items before dispatch.
       </div>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
         <td style="vertical-align:top;padding:0 12px 16px 0;width:50%;">${label('Delivery address')}${addressBlock(order)}</td>
         <td style="vertical-align:top;padding:0 0 16px;width:50%;">${label('Payment Method')}Cash on Delivery (COD) — Total: ${formatINR(order.total)}</td>
       </tr></table>`
    : '';

  const body = `${h1(`Order ${order.order_number}: ${status}`)}
${p(e(intro))}
${rejectionBlock}
${acceptedDetails}
${itemsHtml}
${totalsHtml}
${tracking ? p(`<strong>Tracking:</strong> ${e(tracking)}${order.tracking_url ? ` — <a href="${e(order.tracking_url)}" style="color:${C.ink};">track shipment</a>` : ''}`) : ''}
${orderUrl ? `<p style="margin:12px 0 0;"><a href="${e(orderUrl)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">View your order</a></p>` : ''}`;

  const text = `Order ${order.order_number}: ${status}\n\n${intro}\n${reason ? `\nReason: ${reason}\n` : ''}${tracking ? `\nTracking: ${tracking}${order.tracking_url ? ` (${order.tracking_url})` : ''}\n` : ''}${orderUrl ? `\nView your order: ${orderUrl}\n` : ''}`;
  return { subject, html: layout({ preheader: intro, body, settings }), text };
}

// Order custom feedback or message from admin
export function orderFeedbackEmail({ order, message, subject, settings, orderUrl }) {
  const emailSubject = subject || `Update regarding your order ${order.order_number}`;
  const currentStatus = orderStatusLabel(order.status);
  const body = `${h1(`Update on order ${order.order_number}`)}
${p(`Hi ${e(order.customer_name)}, our store admin sent an update regarding your order:`)}
<div style="margin:16px 0 24px;padding:18px 20px;background:${C.stone};border-left:4px solid ${C.orange};font-size:15px;line-height:1.6;color:${C.ink};white-space:pre-wrap;">
${e(message)}
</div>
<p style="margin:0 0 16px;font-size:14px;color:${C.muted};">Current order status: <strong style="color:${C.ink};">${e(currentStatus)}</strong></p>
${orderUrl ? `<p style="margin:16px 0 0;"><a href="${e(orderUrl)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">View order details</a></p>` : ''}`;

  const text = `Update on order ${order.order_number}\n\nHi ${order.customer_name},\n\n${message}\n\nCurrent Status: ${currentStatus}\n${orderUrl ? `\nView your order: ${orderUrl}\n` : ''}\nQuestions? Call or WhatsApp ${prettyPhone(settings.business_phone)}.`;
  return { subject: emailSubject, html: layout({ preheader: message.slice(0, 90), body, settings }), text };
}

// 3 — contact enquiry notification (admin)
export function enquiryAdminEmail({ enquiry, settings, adminUrl }) {
  const subject = `New enquiry ${enquiry.reference}: ${enquiry.topic}`;
  const body = `${h1('New website enquiry')}
${p(`Reference <strong>${e(enquiry.reference)}</strong> — ${e(fmtDate(enquiry.created_at))}`)}
${label('From')}${p(`${e(enquiry.name)}<br><a href="mailto:${e(enquiry.email)}" style="color:${C.ink};">${e(enquiry.email)}</a>${enquiry.phone ? `<br>${e(prettyPhone(enquiry.phone))}` : ''}`)}
${label('Subject')}${p(e(enquiry.topic))}
${label('Message')}<div style="margin:0 0 20px;padding:16px;background:${C.stone};white-space:pre-wrap;">${e(enquiry.message)}</div>
<p style="margin:0;"><a href="${e(adminUrl)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">Open in admin</a></p>`;
  const text = `New website enquiry ${enquiry.reference}\n\nFrom: ${enquiry.name} <${enquiry.email}>${enquiry.phone ? `\nPhone: ${prettyPhone(enquiry.phone)}` : ''}\nSubject: ${enquiry.topic}\n\n${enquiry.message}\n\nAdmin: ${adminUrl}`;
  return { subject, html: layout({ preheader: `${enquiry.name}: ${enquiry.topic}`, body, settings }), text };
}

// 4 — contact acknowledgement (customer)
export function enquiryAckEmail({ enquiry, settings }) {
  const subject = `We received your message — ${enquiry.reference}`;
  const body = `${h1('Thank you for getting in touch')}
${p(`Hi ${e(enquiry.name)}, we have received your message about “${e(enquiry.topic)}”. Our team will reply as soon as possible.`)}
${p(`Your reference number is <strong>${e(enquiry.reference)}</strong>. Please mention it if you contact us about this enquiry.`)}
${p(`For anything urgent, call or WhatsApp ${e(prettyPhone(settings.business_phone))}.`)}`;
  const text = `Thank you for getting in touch\n\nHi ${enquiry.name}, we have received your message about "${enquiry.topic}". Our team will reply as soon as possible.\n\nReference: ${enquiry.reference}\n\nFor anything urgent, call or WhatsApp ${prettyPhone(settings.business_phone)}.`;
  return { subject, html: layout({ preheader: `Reference ${enquiry.reference}`, body, settings }), text };
}

// 5 — password reset
export function passwordResetEmail({ name, link, settings }) {
  const subject = 'Reset your boxel password';
  const body = `${h1('Reset your password')}
${p(`Hi ${e(name)}, we received a request to reset the password for your boxel account. This link works once and expires in 60 minutes.`)}
<p style="margin:8px 0 20px;"><a href="${e(link)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">Choose a new password</a></p>
${p(`<span style="color:${C.muted};font-size:13px;">If you did not ask for this, you can ignore this email — your password stays the same.</span>`)}`;
  const text = `Reset your password\n\nHi ${name}, use this link to choose a new password (valid for 60 minutes, single use):\n${link}\n\nIf you did not ask for this, ignore this email.`;
  return { subject, html: layout({ preheader: 'Choose a new password', body, settings }), text };
}

export function newsletterAdminEmail({ email, settings }) {
  const subject = 'New newsletter subscriber';
  const body = `${h1('New newsletter subscriber')}${p(e(email))}`;
  return { subject, html: layout({ preheader: email, body, settings }), text: `New newsletter subscriber: ${email}` };
}

export function adminReplyEmail({ enquiry, message, settings }) {
  const subject = `Re: ${enquiry.topic} (${enquiry.reference})`;
  const body = `${p(`Hi ${e(enquiry.name)},`)}<div style="white-space:pre-wrap;margin:0 0 20px;">${e(message)}</div>
<div style="margin:24px 0 0;padding:16px;background:${C.stone};font-size:13px;color:${C.muted};white-space:pre-wrap;">Your message (${e(enquiry.reference)}):\n${e(enquiry.message)}</div>`;
  const text = `Hi ${enquiry.name},\n\n${message}\n\n---\nYour message (${enquiry.reference}):\n${enquiry.message}`;
  return { subject, html: layout({ preheader: message.slice(0, 90), body, settings }), text };
}

export function testEmail({ settings }) {
  return {
    subject: 'boxel SMTP test',
    html: layout({ preheader: 'SMTP is working', body: `${h1('SMTP is working')}${p('This test email confirms that the store can send notifications.')}`, settings }),
    text: 'SMTP is working. This test email confirms that the store can send notifications.',
  };
}
