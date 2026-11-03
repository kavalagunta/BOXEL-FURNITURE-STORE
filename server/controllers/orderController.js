import { z } from 'zod';
import { createOrder, getOrderDetail } from '../services/orderService.js';
import { notifyOrderPlaced } from '../services/notificationService.js';
import { email, indianMobile, pincode, text, optionalText, boolish } from '../utils/validators.js';
import { clientIp } from '../utils/helpers.js';
import { notFound } from '../utils/httpError.js';
import { INDIAN_STATES } from '../utils/indianStates.js';

export const checkoutSchema = z.object({
  idempotencyKey: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid checkout session. Refresh and try again.'),
  fullName: text(120, 2),
  email,
  phone: indianMobile,
  line1: text(200, 3),
  line2: optionalText(200),
  city: text(100, 2),
  state: z.string().trim().refine((s) => INDIAN_STATES.includes(s), 'Choose your state or union territory.'),
  pincode,
  country: z.literal('India', { error: 'We currently deliver within India only.' }).optional(),
  deliveryInstructions: optionalText(500),
  orderNotes: optionalText(1000),
  paymentMethod: z.enum(['cod', 'bank_transfer', 'online'], { error: 'Choose a payment method.' }),
  saveAddress: boolish.optional(),
  expectedTotal: z.coerce.number().min(0).optional(),
  items: z
    .array(z.object({ variantId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(99) }))
    .min(1, 'Your cart is empty.')
    .max(50),
});

export async function placeOrder(req, res) {
  const data = req.valid.body;
  const result = await createOrder({ data, customerId: req.customer?.id ?? null, ip: clientIp(req) });

  // Remember the order in this session so the confirmation page can be viewed without an account.
  const recent = new Set(req.session.recentOrders || []);
  recent.add(result.orderNumber);
  req.session.recentOrders = [...recent].slice(-10);

  // Emails go out after the transaction has committed; a mail failure never fails the order.
  if (!result.duplicate) setImmediate(() => notifyOrderPlaced(result.orderId));

  res.status(result.duplicate ? 200 : 201).json({ orderNumber: result.orderNumber, duplicate: result.duplicate });
}

/** Order confirmation: visible to the customer who owns it, or the browser session that placed it. */
export async function confirmation(req, res) {
  const orderNumber = String(req.params.orderNumber).slice(0, 24);
  const inSession = (req.session.recentOrders || []).includes(orderNumber);
  const order = await getOrderDetail('order_number = ?', [orderNumber]);
  const owns = order && req.customer && order.customer_id === req.customer.id;
  if (!order || (!inSession && !owns)) throw notFound('We could not find this order in your current session. Sign in to see your orders.');
  res.json({ order });
}
