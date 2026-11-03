import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { env, SERVER_ROOT } from '../config/env.js';

const conn = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
  database: env.db.database, multipleStatements: true,
});

async function hasColumn(table, column) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [table, column]);
  return Number(row.n) > 0;
}

async function hasIndex(table, index) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?', [table, index]);
  return Number(row.n) > 0;
}

async function hasConstraint(name) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME=?', [name]);
  return Number(row.n) > 0;
}

async function addColumn(table, column, definition) {
  if (await hasColumn(table, column)) return;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`[schema] Added ${table}.${column}`);
}

async function addIndex(table, name, definition) {
  if (await hasIndex(table, name)) return;
  await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` ${definition}`);
  console.log(`[schema] Added index ${table}.${name}`);
}

async function addForeignKey(table, name, column, target, targetColumn, onDelete) {
  if (await hasConstraint(name)) return;
  const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\` t LEFT JOIN \`${target}\` p ON p.\`${targetColumn}\`=t.\`${column}\` WHERE t.\`${column}\` IS NOT NULL AND p.\`${targetColumn}\` IS NULL`);
  if (Number(n)) {
    console.warn(`[schema] Kept ${table}.${column} without foreign key ${name}: ${n} existing reference(s) do not match ${target}.`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${target}\` (\`${targetColumn}\`) ON DELETE ${onDelete}`);
  console.log(`[schema] Added foreign key ${name}`);
}

try {
  const schemaFile = path.join(SERVER_ROOT, '..', 'database', 'schema.sql');
  await conn.query(await fs.readFile(schemaFile, 'utf8'));

  await conn.query("ALTER TABLE orders MODIFY COLUMN status ENUM('placed','pending','accepted','confirmed','processing','shipped','delivered','rejected','cancelled') NOT NULL DEFAULT 'placed'");
  await addColumn('orders', 'accepted_at', 'DATETIME NULL');
  await addColumn('orders', 'accepted_by', 'INT UNSIGNED NULL');
  await addColumn('orders', 'rejected_at', 'DATETIME NULL');
  await addColumn('orders', 'rejection_reason', 'VARCHAR(500) NULL');

  await addColumn('product_images', 'cloudinary_public_id', 'VARCHAR(255) NULL');
  await addColumn('categories', 'cloudinary_public_id', 'VARCHAR(255) NULL');
  await addColumn('banners', 'desktop_image_public_id', 'VARCHAR(255) NULL');
  await addColumn('banners', 'mobile_image_public_id', 'VARCHAR(255) NULL');
  await addColumn('banners', 'video_url', 'VARCHAR(500) NULL');
  await addColumn('banners', 'video_public_id', 'VARCHAR(255) NULL');

  await addColumn('products', 'vendor_id', 'INT UNSIGNED NULL');
  await addIndex('products', 'idx_products_vendor', '(vendor_id)');
  await addForeignKey('products', 'fk_products_vendor', 'vendor_id', 'vendors', 'id', 'SET NULL');

  await addColumn('email_notification_logs', 'customer_id', 'INT UNSIGNED NULL');
  await addColumn('email_notification_logs', 'message_body', 'TEXT NULL');
  await addColumn('email_notification_logs', 'provider_message_id', 'VARCHAR(190) NULL');

  await addColumn('notifications_log', 'vendor_id', 'INT UNSIGNED NULL');
  await addIndex('notifications_log', 'idx_nl_vendor', '(vendor_id)');
  await addForeignKey('notifications_log', 'fk_nl_order', 'order_id', 'orders', 'id', 'CASCADE');
  await addForeignKey('notifications_log', 'fk_nl_vendor', 'vendor_id', 'vendors', 'id', 'SET NULL');

  console.log('[schema] App schema reconciliation complete. Existing rows were preserved.');
} finally {
  await conn.end();
}
