import { verifyCredentials } from '../authController.js';
import { regenerateSession } from '../../middleware/auth.js';
import { logActivity } from '../../services/activityLog.js';

export async function login(req, res) {
  const { email, password } = req.valid.body;
  let admin;
  try {
    admin = await verifyCredentials('admins', email, password);
  } catch (err) {
    console.warn(`[admin-auth] failed sign-in for ${email} from ${req.ip}`);
    throw err;
  }
  req.session.adminId = admin.id;
  await regenerateSession(req);
  req.admin = admin;
  await logActivity(req, 'admin.login', 'admin', admin.id);
  res.json({ admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
}

export async function logout(req, res) {
  if (req.session.adminId) {
    req.admin = { id: req.session.adminId };
    await logActivity(req, 'admin.logout', 'admin', req.session.adminId);
  }
  delete req.session.adminId;
  await regenerateSession(req);
  res.json({ ok: true });
}

export function me(req, res) {
  const { id, name, email, role } = req.admin;
  res.json({ admin: { id, name, email, role } });
}
