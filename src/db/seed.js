/**
 * Creates a first admin account so you can log in and start managing the gym.
 * Usage: ADMIN_EMAIL=you@gym.com ADMIN_PASSWORD=changeme npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./pool');

async function run() {
  const name = process.env.ADMIN_NAME || 'Gym Owner';
  const email = process.env.ADMIN_EMAIL || 'admin@legends.local';
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const phone = process.env.ADMIN_PHONE || '9842000000';  
  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO app_user (name, email, password_hash, role, phone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email`, [name, email, passwordHash, 'admin', phone]
  );

  if (rows[0]) {
    console.log('Admin created:', rows[0]);
    console.log(`Login with email="${email}" password="${password}"`);
  } else {
    console.log(`Admin with email ${email} already exists — skipped.`);
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
