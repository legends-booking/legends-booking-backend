require('dotenv').config();
const { Pool } = require('pg');

// pg reads PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD from env automatically,
// but we pass them explicitly so the source of truth is visible here.
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT? Number(process.env.PGPORT): undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

pool.on('error', (err) => {
  // Catches errors on idle clients so one bad connection doesn't crash the process
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * @param {string} text
 * @param {any[]} params
 * @returns {Promise<import('pg').QueryResult>}
 */

function query(text, params){
  return pool.query(text, params);
}
module.exports = {
  pool,
  query
};
