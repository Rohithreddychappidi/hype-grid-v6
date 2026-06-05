// src/services/alertService.js
const axios = require('axios');

class AlertService {
  constructor() {
    this.token  = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.queue  = [];
    this.sending = false;
    // Process queue every 1 second (avoid Telegram rate limits)
    setInterval(() => this._processQueue(), 1000);
  }

  async send(msg) {
    this.queue.push(msg);
  }

  async _processQueue() {
    if (this.sending || this.queue.length === 0) return;
    if (!this.token || !this.chatId) {
      this.queue = []; // clear queue if telegram not configured
      return;
    }
    this.sending = true;
    const msg = this.queue.shift();
    try {
      await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        { chat_id: this.chatId, text: msg, parse_mode: 'Markdown' },
        { timeout: 5000 }
      );
    } catch(e) {
      // Only log once, don't spam console
      if (!this._telegramErrorLogged) {
        console.log('[Alert] Telegram not configured or unreachable — alerts disabled');
        console.log('[Alert] To enable: add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env');
        this._telegramErrorLogged = true;
      }
    } finally {
      this.sending = false;
    }
  }

  gridBuilt({ levels, upper, lower, symbol, paper }) {
    this.send(
      `🔷 *Grid Built* ${paper ? '\\[PAPER\\]' : '\\[LIVE\\]'}\n` +
      `Symbol: \`${symbol}\`\n` +
      `Levels: ${levels}\n` +
      `Range: $${parseFloat(lower).toFixed(3)} — $${parseFloat(upper).toFixed(3)}`
    );
  }

  gridFill({ symbol, side, price, dailyPnl, paper }) {
    const emoji = side === 'Buy' ? '🟢' : '🔴';
    this.send(
      `${emoji} *Grid Fill* ${paper ? '\\[PAPER\\]' : ''}\n` +
      `${symbol} ${side} @ $${parseFloat(price).toFixed(4)}\n` +
      `Daily PnL: $${parseFloat(dailyPnl).toFixed(2)}`
    );
  }

  gridPaused(reason) {
    this.send(`⏸ *Grid Paused*\nReason: ${reason}`);
  }

  gridResumed() {
    this.send(`▶️ *Grid Resumed*\nMarket back to ranging — grid active`);
  }

  trendDetected(mode, price) {
    const emoji = mode === 'UPTREND' ? '📈' : '📉';
    this.send(`${emoji} *Trend Detected: ${mode}*\nPrice: $${price}\nGrid paused — monitoring`);
  }

  stopLoss(price, dailyPnl) {
    this.send(
      `🚨 *STOP LOSS TRIGGERED*\n` +
      `Price: $${price}\n` +
      `Daily PnL: $${parseFloat(dailyPnl).toFixed(2)}\n` +
      `Grid paused.`
    );
  }

  dailyReport({ dailyPnl, totalTrades, winRate, balance }) {
    const emoji = dailyPnl >= 0 ? '✅' : '❌';
    this.send(
      `${emoji} *Daily Report*\n` +
      `PnL: $${parseFloat(dailyPnl).toFixed(2)}\n` +
      `Trades: ${totalTrades}\n` +
      `Balance: $${parseFloat(balance).toFixed(2)}`
    );
  }

  error(context, message) {
    this.send(`🚨 *Error: ${context}*\n\`${message}\``);
  }
}

module.exports = new AlertService();
