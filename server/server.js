import { env, assertConfig } from './config/env.js';
import { checkDatabase, pool } from './config/db.js';
import { verifySmtp } from './services/emailService.js';
import { createApp } from './app.js';

assertConfig();

try {
  const version = await checkDatabase();
  console.log(`[db] Connected to ${env.db.database} on ${env.db.host}:${env.db.port} (${version})`);
} catch (err) {
  console.error(`[db] Cannot connect to MySQL at ${env.db.host}:${env.db.port} (database "${env.db.database}").`);
  console.error(`[db] ${err.code || ''} ${err.message}`);
  console.error('[db] Is MySQL running in the XAMPP Control Panel, and have you imported database/schema.sql?');
  process.exit(1);
}

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`[api] boxel API listening on ${env.apiUrl} (${env.nodeEnv})`);
  verifySmtp();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`[api] Port ${env.port} is already in use. Stop the other process or change PORT in server/.env.`);
  else console.error('[api]', err);
  process.exit(1);
});

const shutdown = () => {
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
