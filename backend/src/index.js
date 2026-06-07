// src/index.js
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cron         = require('node-cron');
const wsManager    = require('./services/wsManager');
const gridEngine   = require('./engines/gridEngine');
const marketAnalyzer = require('./engines/marketAnalyzer');
const alertService = require('./services/alertService');

const isPaper = process.env.PAPER_TRADING === 'true';
const PORT    = process.env.PORT || 3001;
const SYMBOL  = process.env.SYMBOL || 'HYPEUSDT';

// ── Express ──────────────────────────────────────────────────────────────────

const app = express();
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Auth
app.use('/api', (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.key;
  if (process.env.NODE_ENV === 'production' && key !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.use('/api', require('./api/routes'));
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now(), paper: isPaper }));

// ── Grid Event Hooks ─────────────────────────────────────────────────────────

gridEngine.on('grid:built', (info) => {
  alertService.gridBuilt({ ...info, symbol: SYMBOL, paper: isPaper });
});

gridEngine.on('grid:fill', ({ trade, dailyPnl }) => {
  alertService.gridFill({ symbol: SYMBOL, side: trade.side, price: trade.price, dailyPnl, paper: isPaper });
});

gridEngine.on('grid:rebalance', ({ price, reason }) => {
  console.log(`[Main] Grid rebalancing — ${reason} @ $${price}`);
});

gridEngine.on('grid:stoploss', ({ price }) => {
  alertService.stopLoss(price, gridEngine.getState().dailyPnl);
});

gridEngine.on('paused', (reason) => {
  alertService.gridPaused(reason);
});

gridEngine.on('resumed', () => {
  alertService.gridResumed();
});

// ── Scheduled Jobs ────────────────────────────────────────────────────────────

// Analyze market every 3 minutes
cron.schedule('*/3 * * * *', async () => {
  try {
    const state = await marketAnalyzer.analyze();
    const engine = gridEngine.getState();

    // Auto-pause grid if trend starts
    if (!state.isRanging && !engine.paused && engine.running) {
      console.log(`[Main] Trend detected (${state.mode}) — pausing grid`);
      await gridEngine.onTrendDetected(state.mode);
      alertService.trendDetected(state.mode, state.indicators.price);
    }

    // Auto-resume grid if ranging returns
    if (state.isRanging && engine.paused && engine.running) {
      console.log('[Main] Market ranging again — resuming grid');
      await gridEngine.onRangeRestored();
    }
  } catch(e) {
    console.error('[Main] Market analysis error:', e.message);
  }
});

// Daily report at midnight UTC
cron.schedule('0 0 * * *', () => {
  const state = gridEngine.getState();
  alertService.dailyReport({
    dailyPnl:    state.dailyPnl,
    totalTrades: state.totalTrades,
    balance:     state.balance.equity,
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  console.log('');
  console.log('╔════════════════════════════════╗');
  console.log('║   HYPE/USDT Grid Engine        ║');
  console.log(`║   Mode: ${isPaper ? 'PAPER TRADING    ' : 'LIVE TRADING     '}  ║`);
  console.log('╚════════════════════════════════╝');
  console.log('');

  // Connect WebSocket
  wsManager.connectAll();

  // Wait for WS connection
  await new Promise((resolve) => {
    if (wsManager.isPubConn) return resolve();
    wsManager.once('pub:connected', resolve);
    setTimeout(resolve, 8000); // fallback
  });

  // Init grid engine — non-fatal
  try {
    await gridEngine.init();
  } catch(e) {
    console.error('[Startup] Grid init error:', e.message);
    console.log('[Startup] Continuing anyway — grid can be started from dashboard');
  }

  // Start HTTP server
  app.listen(PORT, () => {
    console.log(`✅ API running on http://localhost:${PORT}`);
    console.log(`📊 Symbol: ${SYMBOL}`);
    console.log(`💰 Mode: ${isPaper ? 'PAPER (no real money)' : '⚠️  LIVE TRADING'}`);
    console.log('');
    console.log('Grid is initialized. Use the dashboard or API to start.');
    console.log(`POST http://localhost:${PORT}/api/grid/start  → to start grid`);
    console.log('');
  });
}

start().catch(e => {
  console.error('Fatal error:', e.message);
  alertService.error('STARTUP', e.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await gridEngine.stop();
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  console.error('[Uncaught]', e.message);
  alertService.error('Uncaught Exception', e.message);
});
