const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** ₹12,500 — drops paise when they are zero. */
export const formatINR = (n) => {
  const v = Number(n || 0);
  return Number.isInteger(v) ? inr.format(v) : inrExact.format(v);
};

export const formatDate = (d, opts = { dateStyle: 'medium' }) =>
  d ? new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'Asia/Kolkata' }).format(new Date(d)) : '';

export const formatDateTime = (d) => formatDate(d, { dateStyle: 'medium', timeStyle: 'short' });

/** +918310018733 → +91 83100 18733 */
export function formatPhone(p) {
  const m = String(p || '').match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : p || '';
}

export const telHref = (p) => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;
export const whatsappHref = (p, text) => {
  const digits = String(p || '').replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const ORDER_STATUS = {
  placed: 'Placed',
  pending: 'Placed',
  accepted: 'Accepted',
  confirmed: 'Accepted',
  processing: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
export const PAYMENT_STATUS = { pending: 'Awaiting payment', paid: 'Paid', failed: 'Failed', refunded: 'Refunded', cancelled: 'Cancelled' };
export const PAYMENT_METHOD = { cod: 'Cash on delivery', bank_transfer: 'Pay on confirmation', online: 'Online payment' };

export const AVAILABILITY = {
  available: 'Available',
  coming_soon: 'Coming soon',
  price_not_set: 'Price coming soon',
  out_of_stock: 'Out of stock',
  unavailable: 'Unavailable',
};

/** Plain text with blank-line paragraphs → array of paragraphs (rendered as text, never HTML). */
export const paragraphs = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Shipping line derived from the admin shipping settings. */
export function shippingNote(s) {
  const fee = Number(s?.shipping_fee || 0);
  const threshold = Number(s?.free_shipping_threshold || 0);
  if (fee <= 0) return 'Free shipping across India';
  if (threshold > 0) return `Free shipping on orders of ${formatINR(threshold)} or more`;
  return `Shipping ${formatINR(fee)} across India`;
}

/** RFC 4122 v4 id; falls back when crypto.randomUUID is unavailable (plain-http LAN testing). */
export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
