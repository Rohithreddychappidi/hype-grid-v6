// src/services/paperTrading.js
// Simulates Bybit order fills using real market prices

const EventEmitter = require('events');
const wsManager    = require('./wsManager');

class PaperTrading extends EventEmitter {
  constructor() {
    super();
    const startBal = parseFloat(process.env.PAPER_BALANCE || 250);
    this.startingBalance = startBal;
    this.balance    = startBal;
    this.totalPnl   = 0;     // Realized PnL tracker
    this.openOrders = new Map(); // orderId → order
    this.positions  = new Map(); // symbol → position
    this.orderCount = 0;
    this.feeRate    = 0.00055; // 0.055% taker
    this.totalFees  = 0;
    this.trades     = [];

    // Listen to price updates and check fills
    wsManager.on('price', ({ symbol, price }) => {
      this._checkFills(symbol, price);
    });
  }

  // ── Order Management ─────────────────────────────────────────────────────────

  async placeLimit(symbol, side, qty, price, linkId) {
    const orderId = `PAPER-${++this.orderCount}-${Date.now()}`;
    const order = {
      orderId, linkId, symbol, side,
      orderType: 'Limit', qty: parseFloat(qty),
      price: parseFloat(price),
      status: 'New', createdAt: Date.now(),
    };
    this.openOrders.set(orderId, order);
    console.log(`[Paper] Limit ${side} ${qty} ${symbol} @ ${price} → ${orderId}`);
    return { orderId, orderLinkId: linkId };
  }

  async placeMarket(symbol, side, qty, reduceOnly = false) {
    const price = wsManager.getPrice(symbol) || 0;
    const orderId = `PAPER-${++this.orderCount}-${Date.now()}`;
    await this._fill({ orderId, symbol, side, qty: parseFloat(qty), price, orderType: 'Market', reduceOnly });
    return { orderId };
  }

  async cancelOrder(symbol, orderId) {
    const order = this.openOrders.get(orderId);
    if (order) {
      order.status = 'Cancelled';
      this.openOrders.delete(orderId);
    }
    return { orderId };
  }

  async cancelAll(symbol) {
    const toCancel = [...this.openOrders.values()].filter(o => o.symbol === symbol);
    toCancel.forEach(o => {
      o.status = 'Cancelled';
      this.openOrders.delete(o.orderId);
    });
    console.log(`[Paper] Cancelled ${toCancel.length} orders for ${symbol}`);
    return { cancelledOrders: toCancel.length };
  }

  async getOpenOrders(symbol) {
    return [...this.openOrders.values()].filter(o => !symbol || o.symbol === symbol);
  }

  // ── Fill Logic ────────────────────────────────────────────────────────────────

  _checkFills(symbol, price) {
    for (const [id, order] of this.openOrders) {
      if (order.symbol !== symbol) continue;

      let filled = false;
      if (order.side === 'Buy'  && price <= order.price) filled = true;
      if (order.side === 'Sell' && price >= order.price) filled = true;

      if (filled) {
        this.openOrders.delete(id);
        this._fill({ ...order, price: order.price }).catch(() => {});
      }
    }
  }

  async _fill(order) {
    const fee = order.qty * order.price * this.feeRate;
    this.totalFees += fee;

    // Grid futures logic:
    // Each fill is one side of a round trip
    // BUY fill  → open long position at this price
    // SELL fill → close long OR open short, realize PnL

    const key = `${order.symbol}_${order.orderId.split('-')[2]}`; // level key
    const pendingKey = `pending_${order.symbol}_${order.linkId || order.orderId}`;

    // Track open grid positions by level
    // When BUY fills → store entry price
    // When SELL fills → calculate profit from paired BUY
    const levelKey = order.linkId ? order.linkId.replace('grid-refresh-','').replace('grid-','') : null;

    if (order.side === 'Buy') {
      // Opening long — store as pending position
      this.positions.set(pendingKey, {
        symbol:     order.symbol,
        side:       'Long',
        qty:        order.qty,
        entryPrice: order.price,
        fee,
      });
    } else {
      // Closing — find matching open long or treat as new short
      // For grid: every sell = profit of (sell_price - buy_price) * qty
      // We track this simply: realized PnL per fill pair
      // Grid spacing = profit per round trip
    }

    // Simple accurate PnL tracking:
    // Grid engine already calculates profit as spacing × qty
    // Paper trading just needs to track total realized PnL
    // We add the realized amount when gridEngine._onFill runs

    const trade = {
      orderId:  order.orderId,
      symbol:   order.symbol,
      side:     order.side,
      qty:      order.qty,
      price:    order.price,
      fee,
      linkId:   order.linkId,
      filledAt: Date.now(),
    };
    this.trades.push(trade);
    this.emit('fill', trade);
    // Note: balance log happens after gridEngine calls recordProfit
  }

  // Called by gridEngine after each fill with actual profit
  recordProfit(pnl, fee) {
    this.totalPnl  += pnl;
    this.totalFees += fee;
    const last = this.trades[this.trades.length - 1];
    if (last) {
      console.log(`[Paper] FILL ${last.side} ${last.qty} ${last.symbol} @ ${parseFloat(last.price).toFixed(4)} | PnL: $${this.totalPnl.toFixed(2)} | Balance: $${this.getBalance().equity.toFixed(2)}`);
    }
  }

  // ── State ─────────────────────────────────────────────────────────────────────

  getBalance() {
    return {
      equity:    this.startingBalance + this.totalPnl - this.totalFees,
      available: this.startingBalance,
      upnl:      this.totalPnl,
      totalPnl:  this.totalPnl,
      totalFees: this.totalFees,
    };
  }

  getPositions() {
    return [...this.positions.entries()].map(([symbol, pos]) => {
      const price  = wsManager.getPrice(symbol) || pos.entryPrice;
      const mult   = pos.side === 'Long' ? 1 : -1;
      const upnl   = (price - pos.entryPrice) * pos.qty * mult;
      const upnlPct = (upnl / (pos.entryPrice * pos.qty)) * 100;
      return { symbol, ...pos, currentPrice: price, upnl, upnlPct };
    });
  }

  getTrades(limit = 100) {
    return this.trades.slice(-limit).reverse();
  }

  reset(startingBalance = 10000) {
    this.startingBalance = startingBalance;
    this.balance  = startingBalance;
    this.totalPnl = 0;
    this.totalFees = 0;
    this.openOrders.clear();
    this.positions.clear();
    this.trades = [];
    console.log('[Paper] Reset. Starting balance: $' + startingBalance);
  }
}

module.exports = new PaperTrading();
