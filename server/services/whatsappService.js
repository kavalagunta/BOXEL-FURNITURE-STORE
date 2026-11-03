import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { getSettings } from './settingsService.js';

/**
 * Normalizes phone numbers to standard E.164 (+91XXXXXXXXXX) format.
 */
export function formatE164(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (String(phone).trim().startsWith('+')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

/**
 * Formats full delivery address into a single readable string.
 */
export function formatOrderAddress(order) {
  return [
    order.ship_line1,
    order.ship_line2,
    `${order.ship_city}, ${order.ship_state} - ${order.ship_pincode}`,
    order.ship_country || 'India',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Message to shop owner on new order placed.
 */
export function formatOwnerOrderPlacedMessage({ order, items }) {
  const address = formatOrderAddress(order);
  const time = new Date(order.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const lines = [
    `🛒 *New Order #${order.order_number}*`,
    `*Customer:* ${order.customer_name} | *Phone:* ${formatE164(order.customer_phone)}`,
    '',
    '*Items:*',
    ...items.map(
      (item) =>
        `• ${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''} x ${item.quantity} - ₹${Number(item.line_total).toLocaleString('en-IN')}`,
    ),
    '',
    `*Total:* ₹${Number(order.total).toLocaleString('en-IN')} (COD)`,
    `*Address:* ${address}`,
    order.delivery_instructions ? `*Note:* ${order.delivery_instructions}` : null,
    `*Time:* ${time}`,
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Message to shop owner when order status changes (e.g. accepted / rejected).
 */
export function formatOwnerStatusMessage({ order, status, reason }) {
  const isAccepted = status === 'accepted' || status === 'confirmed';
  const isRejected = status === 'rejected' || status === 'cancelled';
  const address = formatOrderAddress(order);

  if (isAccepted) {
    return [
      `📦 *Order #${order.order_number} Accepted by admin*`,
      `*Customer:* ${order.customer_name} | *Phone:* ${formatE164(order.customer_phone)}`,
      `*Total:* ₹${Number(order.total).toLocaleString('en-IN')} (COD)`,
      `*Address:* ${address}`,
    ].join('\n');
  }

  if (isRejected) {
    return [
      `❌ *Order #${order.order_number} Rejected by admin*`,
      `*Customer:* ${order.customer_name} | *Phone:* ${formatE164(order.customer_phone)}`,
      `*Reason:* ${reason || 'Item unavailable or address unserviceable'}`,
    ].join('\n');
  }

  return `ℹ️ Order #${order.order_number} updated to ${status}.`;
}

/**
 * Message to customer when order status changes.
 */
export function formatCustomerStatusMessage({ order, status, reason }) {
  const isAccepted = status === 'accepted' || status === 'confirmed';
  const isRejected = status === 'rejected' || status === 'cancelled';
  const address = formatOrderAddress(order);

  if (isAccepted) {
    return `Hi ${order.customer_name}, your order #${order.order_number} has been accepted and will be delivered to ${address}. Total: ₹${Number(order.total).toLocaleString('en-IN')} (Cash on Delivery).`;
  }

  if (isRejected) {
    return `Hi ${order.customer_name}, sorry, your order #${order.order_number} could not be accepted. Reason: ${reason || 'Item unavailable or address unserviceable'}.`;
  }

  if (status === 'shipped') {
    return `Hi ${order.customer_name}, your order #${order.order_number} has been shipped! It is on its way to ${address}.`;
  }

  if (status === 'delivered') {
    return `Hi ${order.customer_name}, your order #${order.order_number} has been delivered. Thank you for choosing boxel!`;
  }

  return `Hi ${order.customer_name}, your order #${order.order_number} status is now: ${status}.`;
}

/**
 * Generates a wa.me click-to-chat URL with pre-filled message.
 */
export function generateWhatsAppLink(phone, message) {
  const cleanDigits = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
}

/**
 * Sends a WhatsApp message via Cloud API or Twilio with retry logic (up to 3 attempts).
 * If no credentials are configured or delivery fails, records a fallback wa.me link.
 * Never throws an uncaught error. Logs all attempts into notifications_log.
 */
export async function sendWhatsAppMessage({ to, message, orderId, vendorId = null, type = 'order_status', maxRetries = 3 }) {
  const formattedPhone = formatE164(to);
  const cleanDigits = formattedPhone.replace(/\D/g, '');
  const fallbackLink = generateWhatsAppLink(formattedPhone, message);

  // If no recipient phone
  if (!cleanDigits) {
    console.warn('[whatsapp] Missing recipient phone number, skipping notification.');
    return { ok: false, status: 'skipped', error: 'No phone number provided', fallbackLink: null };
  }

  // Check if API credentials exist
  const hasCloudApi = Boolean(env.whatsapp?.cloudApiToken && env.whatsapp?.cloudPhoneId);
  const hasTwilio = Boolean(env.whatsapp?.twilioAccountSid && env.whatsapp?.twilioAuthToken && env.whatsapp?.twilioFrom);

  if (!hasCloudApi && !hasTwilio) {
    // No direct API credentials: log as skipped with wa.me fallback link
    console.log(`[whatsapp:fallback] No API keys configured. wa.me link generated for order ${orderId} (${type}):\n${fallbackLink}`);
    try {
      if (orderId) {
        await query(
          `INSERT INTO notifications_log (order_id, vendor_id, channel, recipient, type, status, error, payload, fallback_link, attempts)
           VALUES (?, ?, 'whatsapp', ?, ?, 'skipped', 'API credentials not configured. Use WhatsApp link.', ?, ?, 1)`,
          [orderId, vendorId, formattedPhone, type, message, fallbackLink],
        );
      }
    } catch (dbErr) {
      console.error('[whatsapp] Error recording notification log:', dbErr.message);
    }
    return { ok: false, status: 'skipped', fallbackLink, reason: 'no_api_credentials' };
  }

  // Attempt sending with retries
  let lastError = null;
  let attempts = 0;

  for (let i = 1; i <= maxRetries; i++) {
    attempts = i;
    try {
      if (hasCloudApi) {
        const response = await fetch(`https://graph.facebook.com/v20.0/${env.whatsapp.cloudPhoneId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.whatsapp.cloudApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanDigits,
            type: 'text',
            text: { preview_url: false, body: message },
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Cloud API error ${response.status}: ${errBody}`);
        }

        console.log(`[whatsapp] Message sent via Cloud API to ${formattedPhone} on attempt ${attempts}`);
        if (orderId) {
          await query(
            `INSERT INTO notifications_log (order_id, vendor_id, channel, recipient, type, status, error, payload, fallback_link, attempts)
             VALUES (?, ?, 'whatsapp', ?, ?, 'sent', NULL, ?, ?, ?)`,
            [orderId, vendorId, formattedPhone, type, message, fallbackLink, attempts],
          );
        }
        return { ok: true, status: 'sent', fallbackLink, attempts };
      }

      if (hasTwilio) {
        const auth = Buffer.from(`${env.whatsapp.twilioAccountSid}:${env.whatsapp.twilioAuthToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('From', `whatsapp:${env.whatsapp.twilioFrom.replace(/^whatsapp:/, '')}`);
        params.append('To', `whatsapp:+${cleanDigits}`);
        params.append('Body', message);

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.whatsapp.twilioAccountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Twilio error ${response.status}: ${errBody}`);
        }

        console.log(`[whatsapp] Message sent via Twilio to ${formattedPhone} on attempt ${attempts}`);
        if (orderId) {
          await query(
            `INSERT INTO notifications_log (order_id, vendor_id, channel, recipient, type, status, error, payload, fallback_link, attempts)
             VALUES (?, ?, 'whatsapp', ?, ?, 'sent', NULL, ?, ?, ?)`,
            [orderId, vendorId, formattedPhone, type, message, fallbackLink, attempts],
          );
        }
        return { ok: true, status: 'sent', fallbackLink, attempts };
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[whatsapp] Send failed (attempt ${attempts}/${maxRetries}): ${err.message}`);
      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * i));
      }
    }
  }

  // All retries failed
  console.error(`[whatsapp] Failed to send message after ${attempts} attempts: ${lastError}`);
  try {
    if (orderId) {
      await query(
        `INSERT INTO notifications_log (order_id, vendor_id, channel, recipient, type, status, error, payload, fallback_link, attempts)
         VALUES (?, ?, 'whatsapp', ?, ?, 'failed', ?, ?, ?, ?)`,
        [orderId, vendorId, formattedPhone, type, (lastError || 'Unknown error').slice(0, 480), message, fallbackLink, attempts],
      );
    }
  } catch (dbErr) {
    console.error('[whatsapp] Error recording notification log:', dbErr.message);
  }

  return { ok: false, status: 'failed', error: lastError, fallbackLink, attempts };
}

/**
 * Handles sending WhatsApp notifications for newly placed orders.
 */
export async function sendWhatsAppNotification({ order, items }) {
  try {
    const settings = await getSettings();
    const ownerPhone = env.whatsapp?.recipientPhone || settings.business_whatsapp || settings.business_phone || '+918310018733';
    const message = formatOwnerOrderPlacedMessage({ order, items });
    return await sendWhatsAppMessage({ to: ownerPhone, message, orderId: order.id, type: 'owner_order_placed' });
  } catch (err) {
    console.error('[whatsapp] sendWhatsAppNotification error:', err.message);
    return { ok: false, status: 'failed', error: err.message };
  }
}

/**
 * Formats message sent to delivery vendor for a new order.
 * Follows exact specified layout:
 * 🛒 *New Order #[ORDER_ID]*
 * 
 * *Items:*
 * 1. [Item name] x [qty] - ₹[price each] = ₹[line total]
 * 
 * *Order total:* ₹[amount] (Cash on Delivery, collect on delivery)
 * 
 * *Customer:* [name] | [phone]
 * *Deliver to:* [full address, pincode]
 * *Placed at:* [date/time]
 */
export function formatVendorOrderPlacedMessage({ order, items, vendorName }) {
  const address = formatOrderAddress(order);
  const time = new Date(order.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const itemList = items.map((item, idx) => {
    const name = `${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''}`;
    const unitPrice = Number(item.unit_price).toLocaleString('en-IN');
    const lineTotal = Number(item.line_total).toLocaleString('en-IN');
    return `${idx + 1}. ${name} x ${item.quantity} - ₹${unitPrice} = ₹${lineTotal}`;
  });

  const lines = [
    `🛒 *New Order #${order.order_number}*`,
    vendorName ? `*Vendor:* ${vendorName}` : null,
    '',
    '*Items:*',
    ...itemList,
    '',
    `*Order total:* ₹${Number(order.total).toLocaleString('en-IN')} (Cash on Delivery, collect on delivery)`,
    '',
    `*Customer:* ${order.customer_name} | ${formatE164(order.customer_phone)}`,
    `*Deliver to:* ${address}`,
    order.delivery_instructions ? `*Note:* ${order.delivery_instructions}` : null,
    `*Placed at:* ${time}`,
  ].filter((l) => l !== null);

  return lines.join('\n');
}

/**
 * Multi-vendor aware vendor WhatsApp notification dispatch:
 * Groups order items by product vendor. If multi-vendor cart, sends each vendor
 * a separate message containing ONLY their assigned items.
 * Falls back to default .env number if product has no assigned vendor or vendor has no number.
 * Never throws — failures are logged to notifications_log.
 */
export async function sendVendorWhatsAppNotification({ order, items, targetVendorId = null }) {
  try {
    // Query products to find assigned vendors for these order items
    const productRows = await query(
      `SELECT oi.id AS order_item_id, oi.product_id, p.vendor_id, 
              v.name AS vendor_name, v.whatsapp_number AS vendor_whatsapp, v.is_active AS vendor_is_active
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       WHERE oi.order_id = ?`,
      [order.id],
    );

    const productVendorMap = new Map();
    for (const row of productRows) {
      productVendorMap.set(row.order_item_id, row);
    }

    // Default vendor phone from env or business settings
    const defaultNumber = env.whatsapp?.vendorPhone || env.whatsapp?.recipientPhone || '+918310018733';

    // Group items by vendor
    const vendorGroups = new Map();

    for (const item of items) {
      const meta = productVendorMap.get(item.id);
      const hasValidVendor = meta?.vendor_id && meta?.vendor_whatsapp && meta?.vendor_is_active;

      const groupKey = hasValidVendor ? `vendor_${meta.vendor_id}` : 'default';
      if (!vendorGroups.has(groupKey)) {
        vendorGroups.set(groupKey, {
          vendorId: hasValidVendor ? meta.vendor_id : null,
          vendorName: hasValidVendor ? meta.vendor_name : 'Default Delivery Vendor',
          whatsappNumber: hasValidVendor ? meta.vendor_whatsapp : defaultNumber,
          items: [],
        });
      }
      vendorGroups.get(groupKey).items.push(item);
    }

    const results = [];
    for (const [, group] of vendorGroups.entries()) {
      // If targetVendorId is passed for manual resend, skip other vendors
      if (targetVendorId && group.vendorId && String(group.vendorId) !== String(targetVendorId)) {
        continue;
      }

      const message = formatVendorOrderPlacedMessage({
        order,
        items: group.items,
        vendorName: group.vendorName,
      });

      const res = await sendWhatsAppMessage({
        to: group.whatsappNumber,
        message,
        orderId: order.id,
        vendorId: group.vendorId,
        type: 'vendor_order_placed',
      });

      results.push({
        vendorId: group.vendorId,
        vendorName: group.vendorName,
        whatsappNumber: group.whatsappNumber,
        itemCount: group.items.length,
        ...res,
      });
    }

    return results;
  } catch (err) {
    console.error(`[whatsapp] sendVendorWhatsAppNotification error for order ${order.id}:`, err.message);
    return [{ ok: false, status: 'failed', error: err.message }];
  }
}
