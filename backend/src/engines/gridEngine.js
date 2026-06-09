// src/engines/gridEngine.js
const EventEmitter   = require('events');
const bybitClient    = require('../exchanges/bybitClient');
const paperTrading   = require('../services/paperTrading');
const wsManager      = require('../services/wsManager');
const marketAnalyzer = require('./marketAnalyzer');
const db             = require('../db');

const isPaper = () => process.env.PAPER_TRADING === 'true';
const exchange = () => isPaper() ? paperTrading : bybitClient;

class GridEngine extends EventEmitter {
  constructor() {
    super();
    this.config      = null;  // loaded from DB
    this.symbol      = process.env.SYMBOL || 'HYPEUSDT';
    this.running     = false;
    this.paused      = false;  // paused due to trend
    this.gridLevels  = [];     // { price, side, orderId, status }
    this.instrInfo   = null;   // minQty, qtyStep, tickSize
    this.dailyPnl    = 0;
    this.totalPnl    = 0;
    this.gridTrades  = 0;
    this.lastRebalAt = 0;

    // Listen for price updates
    wsManager.on('price', ({ symbol, price }) => {
      if (symbol === this.symbol && this.running && !this.paused) {
        this._onPrice(price).catch(e => console.error('[Grid] onPrice error:', e.message));
      }
    });

    // Auto rebuild grid after WS reconnects
    wsManager.on('pub:connected', async () => {
      if (this.running && !this.paused) {
        console.log('[Grid] WS reconnected — resubscribing and checking grid');
        wsManager.subscribeTicker(this.symbol);
        wsManager.subscribeKline(this.symbol, '5');
        // Small delay then verify grid still has orders
        setTimeout(async () => {
          const openOrders = this.gridLevels.filter(l => l.status === 'OPEN');
          if (openOrders.length < this.config?.levels * 0.5) {
            console.log('[Grid] Less than 50% orders active after reconnect — rebuilding');
            await this.buildGrid().catch(e => console.error('[Grid] Rebuild error:', e.message));
          }
        }, 5000);
      }
    });

    // Listen for paper fills
    if (isPaper()) {
      paperTrading.on('fill', (trade) => {
        if (trade.symbol === this.symbol) {
          this._onFill(trade).catch(e => console.error('[Grid] onFill error:', e.message));
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STARTUP
  // ═══════════════════════════════════════════════════════════════════

  async init() {
    // Load config from DB
    const res = await db.query('SELECT * FROM grid_configs WHERE symbol = $1 LIMIT 1', [this.symbol]);
    if (!res.rows[0]) throw new Error('No grid config found. Run migrate first.');
    this.config = res.rows[0];

    // Instrument info — use defaults if Bybit blocks the request
    try {
      this.instrInfo = await bybitClient.getInstrumentInfo(this.symbol);
      console.log(`[Grid] Instrument: minQty=${this.instrInfo.minQty} step=${this.instrInfo.qtyStep} tick=${this.instrInfo.tickSize}`);
    } catch(e) {
      console.warn(`[Grid] Could not fetch instrument info (${e.message}) — using defaults`);
      this.instrInfo = { minQty: 0.1, qtyStep: 0.1, tickSize: 0.001 };
    }

    // Set leverage (live only)
    if (!isPaper()) {
      await bybitClient.setLeverage(this.symbol, this.config.leverage).catch(e =>
        console.warn('[Grid] Could not set leverage:', e.message)
      );
    }

    // Subscribe price feed
    wsManager.subscribeTicker(this.symbol);
    wsManager.subscribeKline(this.symbol, '5');

    // Reset daily PnL at midnight
    this._scheduleDailyReset();

    console.log(`[Grid] Initialized — Symbol: ${this.symbol} | Levels: ${this.config.levels} | Capital: $${this.config.capital} | Mode: ${isPaper() ? 'PAPER' : 'LIVE'}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // START / STOP
  // ═══════════════════════════════════════════════════════════════════

  async start() {
    if (this.running) return;
    this.running = true;
    console.log('[Grid] Starting...');

    // Analyse market first
    await marketAnalyzer.analyze();
    const state = marketAnalyzer.getState();

    if (state.isRanging) {
      await this.buildGrid();
    } else {
      console.log(`[Grid] Market is ${state.mode} — grid on standby`);
      this.paused = true;
    }

    this._logEvent('GRID_STARTED', `Grid started in ${isPaper() ? 'PAPER' : 'LIVE'} mode`);
  }

  async stop() {
    this.running = false;
    await this._cancelAllOrders();
    this.gridLevels = [];
    console.log('[Grid] Stopped');
    this._logEvent('GRID_STOPPED', 'Grid stopped');
  }

  async pause(reason = 'Manual') {
    this.paused = true;
    await this._cancelAllOrders();
    console.log(`[Grid] Paused — ${reason}`);
    this._logEvent('GRID_PAUSED', reason);
    this.emit('paused', reason);
  }

  async resume() {
    this.paused = false;
    console.log('[Grid] Resuming...');
    await this.buildGrid();
    this._logEvent('GRID_RESUMED', 'Grid resumed');
    this.emit('resumed');
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD GRID
  // ═══════════════════════════════════════════════════════════════════

  async buildGrid(centerPrice = null) {
    // Cancel existing orders first
    await this._cancelAllOrders();
    this.gridLevels = [];

    // Get current price
    const price = centerPrice || wsManager.getPrice(this.symbol) || await bybitClient.getPrice(this.symbol);
    if (!price) throw new Error('Cannot get price');

    // Calculate bounds using ATR or fixed %
    const suggested = marketAnalyzer.getSuggestedRange();
    let upper, lower;

    if (suggested.upper && suggested.lower) {
      upper = suggested.upper;
      lower = suggested.lower;
    } else {
      const rangePct = 0.20; // 20% range by default
      upper = price * (1 + rangePct);
      lower = price * (1 - rangePct);
    }

    const spacing = (upper - lower) / this.config.levels;
    const qtyPerLevel = this._calcQtyPerLevel(price, spacing);

    // Save bounds to config
    await db.query(
      'UPDATE grid_configs SET upper_bound=$1, lower_bound=$2, spacing=$3, updated_at=NOW() WHERE symbol=$4',
      [upper, lower, spacing, this.symbol]
    );
    this.config = { ...this.config, upper_bound: upper, lower_bound: lower, spacing };

    console.log(`[Grid] Building ${this.config.levels} levels | Range: $${lower.toFixed(3)} — $${upper.toFixed(3)} | Spacing: $${spacing.toFixed(4)} | QtyPerLevel: ${qtyPerLevel}`);

    // Place orders on every level
    const promises = [];
    for (let i = 0; i < this.config.levels; i++) {
      const levelPrice = lower + spacing * i;
      const rPrice = this._roundPrice(levelPrice);

      if (levelPrice < price) {
        // Buy orders below current price
        promises.push(this._placeLevelOrder(i, rPrice, 'Buy', qtyPerLevel));
      } else {
        // Sell orders above current price
        promises.push(this._placeLevelOrder(i, rPrice, 'Sell', qtyPerLevel));
      }
    }

    await Promise.allSettled(promises);
    console.log(`[Grid] ${this.gridLevels.length} levels active`);
    this.emit('grid:built', { upper, lower, spacing, levels: this.gridLevels.length });
  }

  async _placeLevelOrder(idx, price, side, qty) {
    try {
      const linkId = `grid-${this.symbol}-${idx}-${Date.now()}`;
      const result = await exchange().placeLimit(this.symbol, side, qty, price, linkId);

      // Calculate stop loss for this level
      // BUY orders: stop loss = entry - (2 × spacing)  → max loss = 2 levels
      // SELL orders: stop loss = entry + (2 × spacing) → max loss = 2 levels
      const spacing   = parseFloat(this.config.spacing || 0);
      const stopLoss  = side === 'Buy'
        ? parseFloat((price - spacing * 2).toFixed(4))
        : parseFloat((price + spacing * 2).toFixed(4));

      const level = {
        index:    idx,
        price,
        side,
        qty,
        orderId:  result.orderId,
        linkId,
        status:   'OPEN',
        stopLoss, // ← per level stop loss
        entryPrice: price,
      };
      this.gridLevels.push(level);

      await db.query(
        `INSERT INTO grid_levels (config_id, level_index, price, side, order_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [this.config.id, idx, price, side, result.orderId]
      ).catch(() => {});

    } catch(e) {
      console.error(`[Grid] Failed to place level ${idx} ${side} @ ${price}:`, e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRICE UPDATE HANDLER
  // ═══════════════════════════════════════════════════════════════════

  async _onPrice(price) {
    if (!this.config?.upper_bound || !this.config?.lower_bound) return;

    // ── Emergency drop detection (catches fast crashes like friend's -11%) ────
    const gridCenter    = (parseFloat(this.config.upper_bound) + parseFloat(this.config.lower_bound)) / 2;
    const dropFromCenter = ((gridCenter - price) / gridCenter) * 100;
    if (dropFromCenter > 3 && !this.paused) {
      console.log(`[Grid] ⚠️  Emergency drop ${dropFromCenter.toFixed(1)}% from center — pausing grid`);
      await this.pause('EMERGENCY_DROP');
      this.emit('grid:stoploss', { price, reason: 'EMERGENCY_DROP' });
      return;
    }

    // ── Per-level stop loss check ─────────────────────────────────────────────
    for (const level of this.gridLevels) {
      if (level.status !== 'FILLED') continue;
      const stopHit = level.side === 'Buy'
        ? price <= level.stopLoss
        : price >= level.stopLoss;
      if (stopHit) {
        console.log(`[Grid] Per-level SL hit! Level ${level.index} ${level.side} entry:$${parseFloat(level.entryPrice).toFixed(4)} stop:$${parseFloat(level.stopLoss).toFixed(4)}`);
        level.status = 'STOPPED';
        const lossMultiplier = level.side === 'Buy' ? 1 : -1;
        const loss = (price - parseFloat(level.entryPrice)) * level.qty * lossMultiplier;
        this.dailyPnl += loss;
        this.totalPnl += loss;
        if (isPaper()) paperTrading.recordProfit(loss, 0);
        await db.query(
          `INSERT INTO grid_trades (config_id, level_index, symbol, side, qty, entry_price, exit_price, pnl, status, mode, paper, closed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'CLOSED','GRID',$9,NOW())`,
          [this.config.id, level.index, this.symbol, level.side, level.qty,
           level.entryPrice, price, loss.toFixed(4), isPaper()]
        ).catch(() => {});
        console.log(`[Grid] SL loss: $${loss.toFixed(4)}`);
      }
    }

    // ── Grid-wide stop loss ───────────────────────────────────────────────────
    const stopPrice = this.config.lower_bound * (1 - (this.config.stop_loss_pct || 15) / 100);
    if (price < stopPrice) {
      console.log(`[Grid] ⚠️  GRID STOP LOSS at $${price} (limit $${stopPrice.toFixed(4)})`);
      await this.pause('STOP_LOSS');
      this.emit('grid:stoploss', { price });
      return;
    }

    // ── Daily loss limit ──────────────────────────────────────────────────────
    const maxDailyLoss = -(this.config.capital * 0.05);
    if (this.dailyPnl < maxDailyLoss) {
      console.log(`[Grid] ⚠️  DAILY LOSS LIMIT: $${this.dailyPnl.toFixed(2)} (limit $${maxDailyLoss.toFixed(2)})`);
      await this.pause('DAILY_LOSS_LIMIT');
      this.emit('grid:stoploss', { price, reason: 'DAILY_LOSS_LIMIT' });
      return;
    }

    // ── Price exited range → rebalance ────────────────────────────────────────
    const upperBreak = price > this.config.upper_bound * 1.02;
    const lowerBreak = price < this.config.lower_bound * 0.98;
    if ((upperBreak || lowerBreak) && Date.now() - this.lastRebalAt > 60000) {
      console.log(`[Grid] Price $${price} exited range — Rebalancing`);
      this.lastRebalAt = Date.now();
      this.emit('grid:rebalance', { price, reason: upperBreak ? 'PRICE_ABOVE' : 'PRICE_BELOW' });
      await this.buildGrid(price);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILL HANDLER
  // ═══════════════════════════════════════════════════════════════════

  async _onFill(trade) {
    // Find the level that was filled
    const level = this.gridLevels.find(l => l.orderId === trade.orderId);
    if (!level) return;

    level.status = 'FILLED';
    level.entryPrice = trade.price; // track actual fill price for stop loss
    const profitPerFill = this.config.spacing * level.qty;
    this.dailyPnl  += profitPerFill;
    this.totalPnl  += profitPerFill;
    this.gridTrades++;

    console.log(`[Grid] FILL: ${trade.side} ${trade.qty} @ $${parseFloat(trade.price).toFixed(4)} | Level ${level.index} | Est profit: $${profitPerFill.toFixed(4)} | Daily PnL: $${this.dailyPnl.toFixed(2)}`);

    // Save trade to DB
    await db.query(
      `INSERT INTO grid_trades (config_id, level_index, symbol, side, qty, entry_price, pnl, fee, status, mode, paper)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'CLOSED','GRID',$9)`,
      [this.config.id, level.index, this.symbol, trade.side, trade.qty, trade.price, profitPerFill, trade.fee, isPaper()]
    ).catch(() => {});

    // Update paper balance with actual profit
    if (isPaper()) {
      paperTrading.recordProfit(profitPerFill, trade.fee || 0);
    }

    // Place counter-order on opposite side (grid refresh)
    const counterSide  = trade.side === 'Buy' ? 'Sell' : 'Buy';
    const counterPrice = trade.side === 'Buy'
      ? this._roundPrice(trade.price + this.config.spacing)
      : this._roundPrice(trade.price - this.config.spacing);

    // Only place if within bounds
    if (counterPrice <= this.config.upper_bound && counterPrice >= this.config.lower_bound) {
      try {
        const linkId = `grid-refresh-${level.index}-${Date.now()}`;
        const result = await exchange().placeLimit(this.symbol, counterSide, level.qty, counterPrice, linkId);
        level.orderId = result.orderId;
        level.price   = counterPrice;
        level.side    = counterSide;
        level.status  = 'OPEN';
        console.log(`[Grid] Counter-order: ${counterSide} @ $${counterPrice}`);
      } catch(e) {
        console.error('[Grid] Counter-order failed:', e.message);
      }
    }

    this.emit('grid:fill', { trade, level, dailyPnl: this.dailyPnl, totalPnl: this.totalPnl });
  }

  // ═══════════════════════════════════════════════════════════════════
  // MODE SWITCH (called by main engine when trend detected)
  // ═══════════════════════════════════════════════════════════════════

  async onTrendDetected(mode) {
    if (!this.paused) {
      await this.pause(`TREND_${mode}`);
    }
  }

  async onRangeRestored() {
    if (this.paused && this.running) {
      await this.resume();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  _calcQtyPerLevel(price, spacing) {
    const capitalPerLevel = this.config.capital / this.config.levels;
    const leveraged       = capitalPerLevel * this.config.leverage;
    const rawQty          = leveraged / price;
    return this._roundQty(rawQty);
  }

  _roundPrice(price) {
    const tick = this.instrInfo?.tickSize || 0.001;
    return parseFloat((Math.round(price / tick) * tick).toFixed(10));
  }

  _roundQty(qty) {
    const step = this.instrInfo?.qtyStep || 0.1;
    const min  = this.instrInfo?.minQty  || 0.1;
    const rounded = Math.floor(qty / step) * step;
    return Math.max(rounded, min);
  }

  async _cancelAllOrders() {
    try {
      await exchange().cancelAll(this.symbol);
      this.gridLevels.forEach(l => l.status = 'CANCELLED');
    } catch(e) {
      console.error('[Grid] Cancel all error:', e.message);
    }
  }

  async _logEvent(type, message, data = {}) {
    await db.query(
      'INSERT INTO system_events (type, message, data) VALUES ($1,$2,$3)',
      [type, message, JSON.stringify(data)]
    ).catch(() => {});
  }

  _scheduleDailyReset() {
    const now     = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    setTimeout(() => {
      this.dailyPnl = 0;
      console.log('[Grid] Daily PnL reset');
      this._scheduleDailyReset();
    }, midnight - now);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE (for API/Dashboard)
  // ═══════════════════════════════════════════════════════════════════

  getState() {
    const bal  = isPaper() ? paperTrading.getBalance() : { equity: 0, available: 0, upnl: 0 };
    const pos  = isPaper() ? paperTrading.getPositions() : [];
    const open = this.gridLevels.filter(l => l.status === 'OPEN');
    const filled = this.gridLevels.filter(l => l.status === 'FILLED');
    const currentPrice = wsManager.getPrice(this.symbol) || 0;

    const marketState = marketAnalyzer.getState();
    if (currentPrice && !marketState.indicators?.price) {
      marketState.indicators = { ...marketState.indicators, price: currentPrice };
    }

    return {
      running:      this.running,
      paused:       this.paused,
      paperMode:    isPaper(),
      symbol:       this.symbol,
      levels:       this.config?.levels || 0,
      openOrders:   open.length,
      filledOrders: filled.length,
      dailyPnl:     this.dailyPnl,
      totalPnl:     this.totalPnl,
      totalTrades:  this.gridTrades,
      currentPrice,
      gridLevels:   this.gridLevels,
      config:       this.config,
      balance:      bal,
      positions:    pos,
      market:       marketState,
    };
  }
}

module.exports = new GridEngine();
