// src/engines/marketAnalyzer.js
const bybitClient = require('../exchanges/bybitClient');
const wsManager   = require('../services/wsManager');
const { ema, rsi, atr, adx } = require('./indicators');
const db = require('../db');

class MarketAnalyzer {
  constructor() {
    this.symbol      = process.env.SYMBOL || 'HYPEUSDT';
    this.mode        = 'RANGING'; // RANGING | UPTREND | DOWNTREND
    this.lastAnalysis = null;
    this.klines      = [];
    this.indicators  = {};
  }

  async fetchKlines(interval = '5', limit = 100) {
    try {
      const raw = await bybitClient.getKlines(this.symbol, interval, limit);
      this.klines = raw.map(k => ({
        time:   parseInt(k[0]),
        open:   parseFloat(k[1]),
        high:   parseFloat(k[2]),
        low:    parseFloat(k[3]),
        close:  parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
      return this.klines;
    } catch(e) {
      // Bybit REST blocked on this server — use cached klines or WS price
      const wsPrice = wsManager.getPrice(this.symbol);
      if (wsPrice && this.klines.length > 0) {
        // Update last candle with current WS price
        this.klines[this.klines.length - 1].close = wsPrice;
      }
      // Don't log every time — only first occurrence
      if (!this._klineErrorLogged) {
        console.warn(`[Analyzer] Kline REST blocked (403) — using cached data + WS price`);
        this._klineErrorLogged = true;
      }
      return this.klines;
    }
  }

  async analyze() {
    await this.fetchKlines('5', 100);
    if (this.klines.length < 30) return this.getState();

    const closes = this.klines.map(k => k.close);
    const highs  = this.klines.map(k => k.high);
    const lows   = this.klines.map(k => k.low);

    const ema21   = ema(closes, 21);
    const ema55   = ema(closes, 55);
    const rsi14   = rsi(closes, 14);
    const atr14   = atr(highs, lows, closes, 14);
    const adxData = adx(highs, lows, closes, 14);
    const price   = closes[closes.length - 1];

    this.indicators = {
      price,
      ema21,
      ema55,
      rsi: rsi14,
      atr: atr14,
      adx: adxData.adx,
      diPlus:  adxData.diPlus,
      diMinus: adxData.diMinus,
      atrPercent: atr14 ? (atr14 / price) * 100 : 0,
    };

    // ── Mode Detection ────────────────────────────────────────────────────────
    // Use 22 threshold (more sensitive) to catch trends early
    const isTrending = adxData.adx > 22;
    const prevMode   = this.mode;

    // Strong downtrend — most dangerous for grid
    if (isTrending && ema21 < ema55 && price < ema21) {
      this.mode = 'DOWNTREND';
    // Strong uptrend
    } else if (isTrending && ema21 > ema55 && price > ema21) {
      this.mode = 'UPTREND';
    // Also check price vs recent candles for quick trend detection
    } else if (closes.length >= 5) {
      const recentDrop = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5] * 100;
      if (recentDrop < -2.5) {
        this.mode = 'DOWNTREND'; // dropped 2.5% in last 5 candles = pause grid
      } else if (recentDrop > 2.5) {
        this.mode = 'UPTREND';
      } else {
        this.mode = 'RANGING';
      }
    } else {
      this.mode = 'RANGING';
    }

    const modeChanged = this.mode !== prevMode;
    if (modeChanged) {
      console.log(`[Analyzer] Mode changed: ${prevMode} → ${this.mode} | ADX: ${adxData.adx.toFixed(1)} | Price: ${price}`);
    }

    // ── Log to DB ─────────────────────────────────────────────────────────────
    await db.query(
      `INSERT INTO market_state_log (symbol, mode, price, adx, rsi, ema_fast, ema_slow)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [this.symbol, this.mode, price, adxData.adx, rsi14, ema21, ema55]
    ).catch(() => {});

    this.lastAnalysis = Date.now();
    return this.getState();
  }

  getState() {
    return {
      mode:       this.mode,
      isRanging:  this.mode === 'RANGING',
      isUptrend:  this.mode === 'UPTREND',
      isDowntrend:this.mode === 'DOWNTREND',
      indicators: this.indicators,
      lastUpdate: this.lastAnalysis,
    };
  }

  // Suggested grid range based on ATR
  getSuggestedRange() {
    const atr14 = this.indicators.atr;
    const price = this.indicators.price;
    if (!atr14 || !price) return { upper: null, lower: null };
    const rangeSize = atr14 * 4; // 4x ATR range
    return {
      upper:     price + rangeSize,
      lower:     price - rangeSize,
      rangePct:  (rangeSize / price) * 100,
    };
  }
}

module.exports = new MarketAnalyzer();
