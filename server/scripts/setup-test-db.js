/**
 * Recreates the separate test database (default: boxel_store_test) from
 * database/schema.sql + database/seed.sql. Never touches the main database.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

process.env.NODE_ENV = 'test';
const { env, SERVER_ROOT } = await import('../config/env.js');

const dbName = process.env.TEST_DB_NAME || (env.db.database.endsWith('_test') ? env.db.database : `${env.db.database}_test`);
if (!dbName.endsWith('_test')) {
  console.error('Refusing to reset a database whose name does not end in _test.');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  multipleStatements: true,
});
await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.query(`USE \`${dbName}\``);
for (const file of ['schema.sql', 'seed.sql']) {
  await conn.query(await fs.readFile(path.join(SERVER_ROOT, '..', 'database', file), 'utf8'));
}
await conn.end();
console.log(`[test-db] ${dbName} recreated from schema.sql + seed.sql`);
