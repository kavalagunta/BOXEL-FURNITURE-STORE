import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_NAME || 'boxel_store',
  });

  console.log('Connected to MySQL. Running migrations...');

  // Helper to check if a column exists
  async function columnExists(table, column) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows[0].count > 0;
  }

  // 1. Update orders table status enum to include placed, accepted, rejected
  console.log('Updating orders table status enum...');
  await conn.query(`
    ALTER TABLE orders 
    MODIFY COLUMN status ENUM('placed', 'pending', 'accepted', 'confirmed', 'processing', 'shipped', 'delivered', 'rejected', 'cancelled') 
    NOT NULL DEFAULT 'pending'
  `);

  // Add columns to orders if not existing
  if (!(await columnExists('orders', 'accepted_at'))) {
    console.log('Adding accepted_at to orders...');
    await conn.query('ALTER TABLE orders ADD COLUMN accepted_at DATETIME NULL AFTER status');
  }
  if (!(await columnExists('orders', 'accepted_by'))) {
    console.log('Adding accepted_by to orders...');
    await conn.query('ALTER TABLE orders ADD COLUMN accepted_by INT UNSIGNED NULL AFTER accepted_at');
  }
  if (!(await columnExists('orders', 'rejected_at'))) {
    console.log('Adding rejected_at to orders...');
    await conn.query('ALTER TABLE orders ADD COLUMN rejected_at DATETIME NULL AFTER accepted_by');
  }
  if (!(await columnExists('orders', 'rejection_reason'))) {
    console.log('Adding rejection_reason to orders...');
    await conn.query('ALTER TABLE orders ADD COLUMN rejection_reason VARCHAR(500) NULL AFTER rejected_at');
  }

  // 2. Update email_notification_logs table
  if (!(await columnExists('email_notification_logs', 'customer_id'))) {
    console.log('Adding customer_id to email_notification_logs...');
    await conn.query('ALTER TABLE email_notification_logs ADD COLUMN customer_id INT UNSIGNED NULL AFTER recipient');
  }
  if (!(await columnExists('email_notification_logs', 'message_body'))) {
    console.log('Adding message_body to email_notification_logs...');
    await conn.query('ALTER TABLE email_notification_logs ADD COLUMN message_body TEXT NULL AFTER subject');
  }
  if (!(await columnExists('email_notification_logs', 'provider_message_id'))) {
    console.log('Adding provider_message_id to email_notification_logs...');
    await conn.query('ALTER TABLE email_notification_logs ADD COLUMN provider_message_id VARCHAR(190) NULL AFTER error_message');
  }

  // 3. Create notifications_log table
  console.log('Creating notifications_log table if not exists...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id INT UNSIGNED NOT NULL,
      channel ENUM('whatsapp', 'email') NOT NULL,
      recipient VARCHAR(190) NOT NULL,
      type VARCHAR(60) NOT NULL,
      status ENUM('pending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
      error VARCHAR(500) NULL,
      payload TEXT NULL,
      fallback_link VARCHAR(1000) NULL,
      attempts INT UNSIGNED NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_nl_order (order_id),
      KEY idx_nl_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('Migration completed successfully!');
  await conn.end();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

