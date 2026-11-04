import { query, queryOne } from '../config/db.js';
import { notFound } from '../utils/httpError.js';

const connections = new Map();
const customerConnections = new Map();
const HEARTBEAT_MS = 25_000;

function sendOrder(res, notification) {
  const payload = { ...notification };
  delete payload.adminId;
  res.write(`id: ${notification.notificationId}\n`);
  res.write('event: new-order\n');
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  res.flush?.();
}

function orderRows(where, params, limit) {
  return query(
    `SELECT n.id AS notificationId, n.admin_id AS adminId, o.id AS orderId, o.order_number AS orderNumber,
            o.customer_name AS customerName, o.total, o.created_at AS createdAt, n.read_at AS readAt
       FROM admin_order_notifications n
       JOIN orders o ON o.id = n.order_id
      WHERE ${where}
      ORDER BY n.id DESC ${limit ? 'LIMIT ?' : ''}`,
    limit ? [...params, limit] : params,
  );
}

/** Persisted notifications are committed with the order; this only fans them out to live admins. */
export async function broadcastNewOrder(orderId) {
  const notifications = await orderRows('n.order_id = ? AND n.read_at IS NULL', [orderId]);
  for (const notification of notifications) {
    const clients = connections.get(Number(notification.adminId));
    if (clients) for (const res of clients) sendOrder(res, notification);
  }
}

export async function openOrderEventStream(req, res) {
  const adminId = Number(req.admin.id);
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  let clients = connections.get(adminId);
  if (!clients) {
    clients = new Set();
    connections.set(adminId, clients);
  }
  clients.add(res);

  let closed = false;
  let heartbeat;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clients.delete(res);
    if (!clients.size) connections.delete(adminId);
    res.end();
  };

  req.on('close', close);
  heartbeat = setInterval(async () => {
    try {
      const session = await new Promise((resolve, reject) => {
        req.sessionStore.get(req.sessionID, (err, value) => (err ? reject(err) : resolve(value)));
      });
      const admins = await query('SELECT id FROM admins WHERE id = ? AND is_active = 1 AND role IN (?, ?, ?) LIMIT 1', [adminId, 'support', 'admin', 'super_admin']);
      if (!session?.adminId || Number(session.adminId) !== adminId || !admins.length) return close();
      res.write(`: heartbeat ${Date.now()}\n\n`);
      res.flush?.();
    } catch {
      close();
    }
  }, HEARTBEAT_MS);

  try {
    // A fresh snapshot covers the small gap between the admin's initial fetch and SSE connection.
    const recent = await orderRows('n.admin_id = ? AND n.read_at IS NULL', [adminId], 30);
    if (closed) return;
    for (const notification of recent) sendOrder(res, notification);
  } catch {
    close();
  }
}

function sendCustomerStatus(res, order) {
  res.write('event: order-status\n');
  res.write(`data: ${JSON.stringify({ orderNumber: order.order_number, status: order.status, updatedAt: order.updated_at })}\n\n`);
  res.flush?.();
}

/** Customer status stream is scoped to an owned order or the guest checkout session that placed it. */
export async function openCustomerOrderEventStream(req, res) {
  const orderNumber = String(req.params.orderNumber).slice(0, 24);
  const order = await queryOne('SELECT id, order_number, customer_id, status, updated_at FROM orders WHERE order_number = ?', [orderNumber]);
  const sessionOwnsGuestOrder = (req.session.recentOrders || []).includes(orderNumber);
  const ownsOrder = order && ((req.customer && Number(order.customer_id) === Number(req.customer.id)) || (!order.customer_id && sessionOwnsGuestOrder));
  if (!ownsOrder) throw notFound('Order not found.');

  const orderId = Number(order.id);
  let clients = customerConnections.get(orderId);
  if (!clients) {
    clients = new Set();
    customerConnections.set(orderId, clients);
  }
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.add(res);

  let closed = false;
  let heartbeat;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clients.delete(res);
    if (!clients.size) customerConnections.delete(orderId);
    res.end();
  };
  req.on('close', close);
  heartbeat = setInterval(async () => {
    try {
      const session = await new Promise((resolve, reject) => {
        req.sessionStore.get(req.sessionID, (err, value) => (err ? reject(err) : resolve(value)));
      });
      const currentOrder = await queryOne('SELECT customer_id FROM orders WHERE id = ?', [orderId]);
      const validCustomer = currentOrder?.customer_id && Number(session?.customerId) === Number(currentOrder.customer_id)
        ? await queryOne('SELECT id FROM customers WHERE id = ? AND is_active = 1', [currentOrder.customer_id])
        : null;
      const validGuest = currentOrder && !currentOrder.customer_id && (session?.recentOrders || []).includes(orderNumber);
      if (!validCustomer && !validGuest) return close();
      res.write(`: heartbeat ${Date.now()}\n\n`);
      res.flush?.();
    } catch {
      close();
    }
  }, HEARTBEAT_MS);
  sendCustomerStatus(res, order);
}

export async function broadcastOrderStatus(orderId) {
  const order = await queryOne('SELECT id, order_number, status, updated_at FROM orders WHERE id = ?', [orderId]);
  const clients = customerConnections.get(Number(orderId));
  if (order && clients) for (const res of clients) sendCustomerStatus(res, order);
}
