import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const conn = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.database });
async function add(table, column, definition) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
  if (!row.n) { await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`); console.log(`[migration] Added ${table}.${column}`); }
}
try {
  await add('product_images', 'cloudinary_public_id', 'VARCHAR(255) NULL');
  await add('categories', 'cloudinary_public_id', 'VARCHAR(255) NULL');
  await add('banners', 'desktop_image_public_id', 'VARCHAR(255) NULL');
  await add('banners', 'mobile_image_public_id', 'VARCHAR(255) NULL');
  await add('banners', 'video_url', 'TEXT NULL');
  await add('banners', 'video_public_id', 'VARCHAR(255) NULL');
} finally { await conn.end(); }
