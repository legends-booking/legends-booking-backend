/**
 * Minimal migration runner.
 * Runs any .sql file in ./migrations that hasn't been applied yet, in filename order.
 * Not a replacement for a full tool like node-pg-migrate, but enough to get started.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { pool } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Connects to the maintenance DB (default: postgres) and creates PGDATABASE if missing.
 * Hosted providers that don't allow CREATE DATABASE are skipped gracefully.
 */
async function ensureDatabase() {
  const dbName = process.env.PGDATABASE;
  if (!dbName) {
    throw new Error('PGDATABASE is required in .env');
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
    throw new Error(`Invalid PGDATABASE name "${dbName}" (use letters, numbers, underscore)`);
  }

  const adminDb = process.env.PGADMIN_DATABASE || 'postgres';
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: adminDb,
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn(
      `Could not connect to "${adminDb}" to auto-create database (${err.message}). ` +
        `Assuming "${dbName}" already exists.`
    );
    return;
  }

  try {
    const { rows } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (rows.length === 0) {
      console.log(`Creating database "${dbName}" ...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`  ✓ database created`);
    }
  } finally {
    await client.end();
  }
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function run() {
  await ensureDatabase();

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('No pending migrations. Database is up to date.');
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`Applying ${file} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ ${file} applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    console.log('All migrations applied.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
