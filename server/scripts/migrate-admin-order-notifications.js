import { pool } from '../config/db.js';

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_order_notifications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin_id INT UNSIGNED NOT NULL,
      order_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_admin_order_notifications_order_admin (order_id, admin_id),
      KEY idx_admin_order_notifications_unread (admin_id, read_at, id),
      CONSTRAINT fk_admin_order_notifications_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE,
      CONSTRAINT fk_admin_order_notifications_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    ALTER TABLE orders
    MODIFY COLUMN status ENUM('placed','pending','accepted','confirmed','processing','shipped','delivered','rejected','cancelled')
    NOT NULL DEFAULT 'pending'
  `);
  console.log('[schema] Admin order notifications are ready; new orders default to pending.');
} catch (error) {
  console.error('[schema] Could not set up admin order notifications:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
