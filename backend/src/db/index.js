// src/db/index.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // works with Neon
  max: 10
});
pool.on('error', e => console.error('[DB] Pool error:', e.message));
const query = (text, params) => pool.query(text, params);
module.exports = { query, pool };
