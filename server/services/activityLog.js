import { query } from '../config/db.js';
import { clientIp } from '../utils/helpers.js';

/** Records an admin action. Never throws — an audit-log failure must not break the action itself. */
export async function logActivity(req, action, entityType = null, entityId = null, details = null) {
  try {
    await query(
      'INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.admin?.id ?? null, action, entityType, entityId === null ? null : String(entityId), details ? JSON.stringify(details) : null, clientIp(req)],
    );
  } catch (err) {
    console.error('[activity-log] failed to record', action, err.message);
  }
}
