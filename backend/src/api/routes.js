// src/api/routes.js
const express      = require('express');
const router       = express.Router();
const gridEngine   = require('../engines/gridEngine');
const marketAnalyzer = require('../engines/marketAnalyzer');
const paperTrading = require('../services/paperTrading');
const bybitClient  = require('../exchanges/bybitClient');
const wsManager    = require('../services/wsManager');
const db           = require('../db');

const isPaper = () => process.env.PAPER_TRADING === 'true';

// ── Dashboard State ───────────────────────────────────────────────────────────

router.get('/state', (req, res) => {
  res.json(gridEngine.getState());
});

router.get('/status', async (req, res) => {
  const [apiOk, wsState] = await Promise.all([
    bybitClient.ping(),
    wsManager.getStatus(),
  ]);
  res.json({
    api:   { connected: apiOk },
    ws:    wsState,
    paper: isPaper(),
    uptime: process.uptime(),
  });
});

// ── Grid Control ──────────────────────────────────────────────────────────────

router.post('/grid/start', async (req, res) => {
  try {
    await gridEngine.start();
    res.json({ success: true, state: gridEngine.getState() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/grid/stop', async (req, res) => {
  try {
    await gridEngine.stop();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/grid/pause', async (req, res) => {
  try {
    await gridEngine.pause('Manual');
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/grid/resume', async (req, res) => {
  try {
    await gridEngine.resume();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/grid/rebuild', async (req, res) => {
  try {
    await gridEngine.buildGrid();
    res.json({ success: true, state: gridEngine.getState() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Config ────────────────────────────────────────────────────────────────────

router.get('/config', async (req, res) => {
  const r = await db.query('SELECT * FROM grid_configs WHERE symbol = $1', [process.env.SYMBOL || 'HYPEUSDT']);
  res.json(r.rows[0] || {});
});

router.put('/config', async (req, res) => {
  const { capital, levels, leverage, stop_loss_pct } = req.body;
  try {
    const r = await db.query(
      `UPDATE grid_configs SET capital=$1, levels=$2, leverage=$3, stop_loss_pct=$4, updated_at=NOW()
       WHERE symbol=$5 RETURNING *`,
      [capital, levels, leverage, stop_loss_pct, process.env.SYMBOL || 'HYPEUSDT']
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Market ────────────────────────────────────────────────────────────────────

router.get('/market', async (req, res) => {
  const state = await marketAnalyzer.analyze();
  res.json(state);
});

router.get('/price', (req, res) => {
  const symbol = req.query.symbol || process.env.SYMBOL || 'HYPEUSDT';
  const price  = wsManager.getPrice(symbol);
  res.json({ symbol, price });
});

// ── Trades ────────────────────────────────────────────────────────────────────

router.get('/trades', async (req, res) => {
  const limit = parseInt(req.query.limit || '100');
  const r = await db.query(
    'SELECT * FROM grid_trades ORDER BY opened_at DESC LIMIT $1', [limit]
  );
  res.json(r.rows);
});

router.get('/trades/stats', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const [todayR, totalR] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(pnl),0) pnl, COUNT(*) trades FROM grid_trades WHERE DATE(opened_at)=$1`, [today]),
    db.query(`SELECT COALESCE(SUM(pnl),0) pnl, COUNT(*) trades FROM grid_trades`),
  ]);
  res.json({
    today: { pnl: parseFloat(todayR.rows[0].pnl), trades: parseInt(todayR.rows[0].trades) },
    total: { pnl: parseFloat(totalR.rows[0].pnl), trades: parseInt(totalR.rows[0].trades) },
  });
});

router.get('/trades/daily', async (req, res) => {
  const r = await db.query(
    `SELECT DATE(opened_at) date, SUM(pnl) pnl, COUNT(*) trades
     FROM grid_trades GROUP BY DATE(opened_at) ORDER BY date DESC LIMIT 30`
  );
  res.json(r.rows);
});

// ── Paper Trading ─────────────────────────────────────────────────────────────

router.get('/paper/state', (req, res) => {
  if (!isPaper()) return res.json({ enabled: false });
  res.json({
    enabled:   true,
    balance:   paperTrading.getBalance(),
    positions: paperTrading.getPositions(),
    openOrders: paperTrading.openOrders.size,
    recentTrades: paperTrading.getTrades(20),
  });
});

router.post('/paper/reset', (req, res) => {
  if (!isPaper()) return res.status(400).json({ error: 'Not in paper mode' });
  const startBal = parseFloat(req.body.balance || 10000);
  paperTrading.reset(startBal);
  res.json({ success: true, balance: startBal });
});

// ── Events ────────────────────────────────────────────────────────────────────

router.get('/events', async (req, res) => {
  const r = await db.query('SELECT * FROM system_events ORDER BY created_at DESC LIMIT 50');
  res.json(r.rows);
});

// ── Market State History ──────────────────────────────────────────────────────

router.get('/market/history', async (req, res) => {
  const r = await db.query(
    'SELECT * FROM market_state_log ORDER BY logged_at DESC LIMIT 100'
  );
  res.json(r.rows);
});

module.exports = router;
