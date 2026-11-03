import { queryOne } from '../config/db.js';
import { HttpError, unauthorized, forbidden } from '../utils/httpError.js';

/** Loads the signed-in customer (if any) without requiring one. */
export async function loadCustomer(req, _res, next) {
  if (req.session?.customerId) {
    const customer = await queryOne(
      'SELECT id, name, email, phone, is_active FROM customers WHERE id = ?',
      [req.session.customerId],
    );
    if (customer && customer.is_active) req.customer = customer;
    else delete req.session.customerId;
  }
  next();
}

export function requireCustomer(req, _res, next) {
  if (!req.customer) return next(unauthorized());
  next();
}

/** Every admin request re-checks the account in the database — UI hiding is never authorization. */
export async function requireAdmin(req, _res, next) {
  const adminId = req.session?.adminId;
  if (!adminId) return next(new HttpError(401, 'Admin sign-in required.'));
  const admin = await queryOne('SELECT id, name, email, role, is_active FROM admins WHERE id = ?', [adminId]);
  if (!admin || !admin.is_active) {
    delete req.session.adminId;
    return next(new HttpError(401, 'Admin sign-in required.'));
  }
  req.admin = admin;
  next();
}

/**
 * Roles: super_admin (everything, including admin users and email settings),
 * admin (catalogue, orders, content, settings), support (orders, customers, enquiries, reviews).
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.admin) return next(new HttpError(401, 'Admin sign-in required.'));
    if (req.admin.role === 'super_admin' || roles.includes(req.admin.role)) return next();
    next(forbidden());
  };
}

/** Rotates the session ID on privilege change while keeping cart/CSRF/session context. */
export function regenerateSession(req) {
  const keep = {
    csrfToken: req.session.csrfToken,
    recentOrders: req.session.recentOrders,
    customerId: req.session.customerId,
    adminId: req.session.adminId,
  };
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      for (const [k, v] of Object.entries(keep)) if (v !== undefined) req.session[k] = v;
      resolve();
    });
  });
}
