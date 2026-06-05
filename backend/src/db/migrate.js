// src/db/migrate.js
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
  -- Grid configurations
  CREATE TABLE IF NOT EXISTS grid_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL DEFAULT 'HYPEUSDT',
    capital NUMERIC(12,2) NOT NULL DEFAULT 4000,
    levels INTEGER NOT NULL DEFAULT 20,
    upper_bound NUMERIC(20,8),
    lower_bound NUMERIC(20,8),
    spacing NUMERIC(20,8),
    leverage INTEGER DEFAULT 5,
    stop_loss_pct NUMERIC(5,2) DEFAULT 15,
    enabled BOOLEAN DEFAULT false,
    paper_mode BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Grid levels (each buy/sell point)
  CREATE TABLE IF NOT EXISTS grid_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES grid_configs(id) ON DELETE CASCADE,
    level_index INTEGER NOT NULL,
    price NUMERIC(20,8) NOT NULL,
    side VARCHAR(4) NOT NULL,
    status VARCHAR(20) DEFAULT 'WAITING',
    order_id VARCHAR(100),
    filled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- All trades (grid fills)
  CREATE TABLE IF NOT EXISTS grid_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES grid_configs(id),
    level_index INTEGER,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    qty NUMERIC(20,8) NOT NULL,
    entry_price NUMERIC(20,8) NOT NULL,
    exit_price NUMERIC(20,8),
    pnl NUMERIC(20,8),
    fee NUMERIC(20,8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN',
    mode VARCHAR(10) DEFAULT 'GRID',
    paper BOOLEAN DEFAULT true,
    order_id VARCHAR(100),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
  );

  -- Daily performance
  CREATE TABLE IF NOT EXISTS daily_performance (
    date DATE PRIMARY KEY,
    total_pnl NUMERIC(20,8) DEFAULT 0,
    grid_pnl NUMERIC(20,8) DEFAULT 0,
    trend_pnl NUMERIC(20,8) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_trades INTEGER DEFAULT 0,
    fees_paid NUMERIC(20,8) DEFAULT 0,
    starting_balance NUMERIC(20,8),
    ending_balance NUMERIC(20,8)
  );

  -- Market state log
  CREATE TABLE IF NOT EXISTS market_state_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20),
    mode VARCHAR(20),
    price NUMERIC(20,8),
    adx NUMERIC(8,4),
    rsi NUMERIC(8,4),
    ema_fast NUMERIC(20,8),
    ema_slow NUMERIC(20,8),
    logged_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- System events
  CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50),
    message TEXT,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Default grid config
  INSERT INTO grid_configs (symbol, capital, levels, leverage, paper_mode, enabled)
  VALUES ('HYPEUSDT', 4000, 20, 5, true, false)
  ON CONFLICT DO NOTHING;

  CREATE INDEX IF NOT EXISTS idx_grid_trades_opened ON grid_trades(opened_at);
  CREATE INDEX IF NOT EXISTS idx_grid_trades_status ON grid_trades(status);
  CREATE INDEX IF NOT EXISTS idx_market_state_logged ON market_state_log(logged_at);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(sql);
    console.log('✅ Done');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}
migrate();
