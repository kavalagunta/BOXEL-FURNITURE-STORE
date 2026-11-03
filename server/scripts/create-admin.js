/**
 * Creates (or, with explicit confirmation, resets) an administrator account.
 *
 *   npm run create-admin
 *
 * Prompts for name, email and password (input hidden). For non-interactive use set
 * ADMIN_SETUP_NAME, ADMIN_SETUP_EMAIL and ADMIN_SETUP_PASSWORD in the environment;
 * an existing account is only overwritten if ADMIN_SETUP_OVERWRITE=yes is also set.
 */
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { pool, queryOne, query } from '../config/db.js';
import { password as passwordRule, email as emailRule } from '../utils/validators.js';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write(s.includes('\n') || s.includes('\r') ? '\n' : '*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const fromEnv = process.env.ADMIN_SETUP_EMAIL && process.env.ADMIN_SETUP_PASSWORD;
  console.log('\nboxel — create administrator\n');

  const name = fromEnv ? process.env.ADMIN_SETUP_NAME || 'Administrator' : await ask('Full name: ');
  const emailInput = fromEnv ? process.env.ADMIN_SETUP_EMAIL : await ask('Email: ');
  const email = emailRule.safeParse(emailInput);
  if (!email.success || !name) throw new Error('A valid name and email are required.');

  const existing = await queryOne('SELECT id, role FROM admins WHERE email = ?', [email.data]);
  if (existing) {
    const confirm = fromEnv ? process.env.ADMIN_SETUP_OVERWRITE : await ask(`An admin with ${email.data} already exists. Reset its password and make it super admin? Type "yes" to confirm: `);
    if (confirm !== 'yes') {
      console.log('No changes made.');
      return;
    }
  }

  const pw = fromEnv ? process.env.ADMIN_SETUP_PASSWORD : await ask('Password (min 10 chars, letters and numbers): ', { hidden: true });
  const check = passwordRule.safeParse(pw);
  if (!check.success) throw new Error(check.error.issues.map((i) => i.message).join(' '));
  if (!fromEnv) {
    const again = await ask('Repeat password: ', { hidden: true });
    if (again !== pw) throw new Error('Passwords do not match.');
  }

  const hash = await bcrypt.hash(pw, 12);
  if (existing) {
    await query("UPDATE admins SET name = ?, password_hash = ?, role = 'super_admin', is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?", [name, hash, existing.id]);
    console.log(`\nUpdated admin ${email.data} (super admin).`);
  } else {
    await query("INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, 'super_admin')", [name, email.data, hash]);
    console.log(`\nCreated super admin ${email.data}. Sign in at /admin/login.`);
  }
}

main()
  .catch((err) => {
    console.error(`\nError: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
