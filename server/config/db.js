import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_ci',
  // All DATETIME values are stored and read as UTC.
  timezone: 'Z',
  decimalNumbers: true,
  namedPlaceholders: false,
});

// CURRENT_TIMESTAMP follows the session time zone, so pin every connection to UTC.
pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

/** Run a parameterized query and return rows. */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/**
 * Run `fn(conn)` inside a transaction. Commits on success, rolls back on any error.
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* connection may already be gone */ }
    throw err;
  } finally {
    conn.release();
  }
}

export async function checkDatabase() {
  const [rows] = await pool.query('SELECT VERSION() AS version');
  return rows[0].version;
}
