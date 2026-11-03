import { pool } from '../config/db.js';
import { getSettings, flag, num } from './settingsService.js';
import { toPaise, toRupees } from '../utils/helpers.js';

export const MAX_QTY_PER_LINE = 10;

/** Effective selling price in paise for a product + variant. */
export function unitPricePaise(product, variant) {
  const price = toPaise(product.price);
  const sale = product.sale_price === null || product.sale_price === undefined ? null : toPaise(product.sale_price);
  const base = sale !== null && sale > 0 && sale < price ? sale : price;
  return base + toPaise(variant?.price_adjustment ?? 0);
}

/**
 * Why a product can or cannot be bought. A price of 0 means the admin has not set one yet.
 * Returns null when purchasable, otherwise a short reason code.
 */
export function unavailableReason(p) {
  if (p.status === 'coming_soon' || p.category_status === 'coming_soon') return 'coming_soon';
  if (p.status !== 'active' || (p.category_status && p.category_status !== 'active')) return 'unavailable';
  if (!(Number(p.price) > 0)) return 'price_not_set';
  return null;
}

export function shippingFor(subtotalPaise, settings) {
  if (subtotalPaise <= 0) return 0;
  const fee = toPaise(num(settings, 'shipping_fee'));
  const threshold = toPaise(num(settings, 'free_shipping_threshold'));
  if (fee <= 0) return 0;
  if (threshold > 0 && subtotalPaise >= threshold) return 0;
  return fee;
}

export function taxFor(subtotalPaise, settings) {
  if (!flag(settings, 'tax_enabled')) return { amount: 0, inclusive: false, label: null };
  const rate = num(settings, 'tax_rate');
  if (!(rate > 0)) return { amount: 0, inclusive: false, label: null };
  const inclusive = flag(settings, 'prices_include_tax');
  const amount = inclusive ? Math.round((subtotalPaise * rate) / (100 + rate)) : Math.round((subtotalPaise * rate) / 100);
  const label = `${settings.tax_label || 'Tax'} (${rate}%${inclusive ? ', included' : ''})`;
  return { amount, inclusive, label };
}

/** Collapses duplicate variant lines and drops invalid entries. */
export function normalizeItems(items) {
  const merged = new Map();
  for (const it of items || []) {
    const variantId = Number(it.variantId);
    const quantity = Math.floor(Number(it.quantity));
    if (!Number.isInteger(variantId) || variantId <= 0 || !Number.isFinite(quantity) || quantity <= 0) continue;
    merged.set(variantId, (merged.get(variantId) || 0) + quantity);
  }
  return [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Prices a cart from live database values. Never trusts client prices.
 * Pass `conn` + `lock: true` inside a transaction to lock the variant rows (checkout).
 */
export async function quoteCart(rawItems, { conn = pool, lock = false, settings = null } = {}) {
  const items = normalizeItems(rawItems).slice(0, 50);
  settings = settings || (await getSettings());
  const lines = [];
  const issues = [];

  let rows = [];
  if (items.length) {
    const ids = items.map((i) => i.variantId);
    [rows] = await conn.query(
      `SELECT v.id AS variant_id, v.name AS variant_name, v.color_hex, v.sku AS variant_sku, v.price_adjustment,
              v.stock_quantity, v.is_active AS variant_active,
              p.id AS product_id, p.name, p.slug, p.sku, p.price, p.sale_price, p.status, p.track_stock,
              c.status AS category_status,
              (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS image_url
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         JOIN categories c ON c.id = p.category_id
        WHERE v.id IN (?)${lock ? ' FOR UPDATE' : ''}`,
      [ids],
    );
  }
  const byId = new Map(rows.map((r) => [r.variant_id, r]));

  let subtotal = 0;
  for (const item of items) {
    const r = byId.get(item.variantId);
    if (!r) {
      issues.push({ variantId: item.variantId, code: 'not_found', message: 'An item in your cart is no longer available.' });
      lines.push({ variantId: item.variantId, quantity: item.quantity, issue: 'not_found' });
      continue;
    }
    let issue = unavailableReason(r);
    if (!issue && !r.variant_active) issue = 'unavailable';
    const maxQuantity = r.track_stock ? Math.min(MAX_QTY_PER_LINE, Math.max(0, r.stock_quantity)) : MAX_QTY_PER_LINE;
    if (!issue && r.track_stock && r.stock_quantity <= 0) issue = 'out_of_stock';
    if (!issue && item.quantity > maxQuantity) issue = 'insufficient_stock';

    const unit = unitPricePaise(r, r);
    const lineTotal = unit * item.quantity;
    if (!issue) subtotal += lineTotal;
    else {
      const messages = {
        coming_soon: `${r.name} is coming soon and cannot be ordered yet.`,
        unavailable: `${r.name} (${r.variant_name}) is not available right now.`,
        price_not_set: `${r.name} is not available to order yet.`,
        out_of_stock: `${r.name} (${r.variant_name}) is out of stock.`,
        insufficient_stock: `Only ${maxQuantity} of ${r.name} (${r.variant_name}) can be ordered.`,
      };
      issues.push({ variantId: r.variant_id, code: issue, message: messages[issue], maxQuantity });
    }

    lines.push({
      variantId: r.variant_id,
      productId: r.product_id,
      name: r.name,
      slug: r.slug,
      sku: r.variant_sku || r.sku,
      variantName: r.variant_name,
      colorHex: r.color_hex,
      imageUrl: r.image_url,
      unitPrice: toRupees(unit),
      quantity: item.quantity,
      lineTotal: toRupees(lineTotal),
      maxQuantity,
      trackStock: Boolean(r.track_stock),
      issue,
      _unitPaise: unit,
      _lineTotalPaise: lineTotal,
    });
  }

  const shipping = shippingFor(subtotal, settings);
  const tax = taxFor(subtotal, settings);
  const total = subtotal + shipping + (tax.inclusive ? 0 : tax.amount);

  return {
    lines,
    issues,
    purchasable: items.length > 0 && issues.length === 0,
    subtotal: toRupees(subtotal),
    shipping: toRupees(shipping),
    tax: { amount: toRupees(tax.amount), inclusive: tax.inclusive, label: tax.label },
    total: toRupees(total),
    currency: 'INR',
    _paise: { subtotal, shipping, tax: tax.amount, total },
  };
}

/** Strips internal fields before sending a quote to the browser. */
export function publicQuote(q) {
  return {
    ...q,
    lines: q.lines.map(({ _unitPaise, _lineTotalPaise, ...rest }) => rest),
    _paise: undefined,
  };
}
