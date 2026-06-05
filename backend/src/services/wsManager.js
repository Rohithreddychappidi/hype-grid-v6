// src/services/wsManager.js
const WebSocket = require('ws');
const crypto    = require('crypto');
const EventEmitter = require('events');

class WSManager extends EventEmitter {
  constructor() {
    super();
    const testnet = process.env.BYBIT_TESTNET === 'true';
    this.pubUrl  = testnet
      ? 'wss://stream-testnet.bybit.com/v5/public/linear'
      : 'wss://stream.bybit.com/v5/public/linear';
    this.privUrl = testnet
      ? 'wss://stream-testnet.bybit.com/v5/private'
      : 'wss://stream.bybit.com/v5/private';

    this.pubWs   = null;
    this.privWs  = null;
    this.pubSubs = new Set();
    this.priceCache = {};
    this.klineCache = {};
    this.pubAttempts  = 0;
    this.privAttempts = 0;
    this.isPubConn  = false;
    this.isPrivConn = false;
    this._pings = {};
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  connectPublic() {
    if (this.pubWs?.readyState === WebSocket.OPEN) return;
    this.pubWs = new WebSocket(this.pubUrl);

    this.pubWs.on('open', () => {
      console.log('[WS:Pub] Connected');
      this.isPubConn = true;
      this.pubAttempts = 0;
      this._ping(this.pubWs, 'pub');
      this._resubscribe();
      this.emit('pub:connected');
    });

    this.pubWs.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (!msg.topic) return;

        // Price ticker
        if (msg.topic.startsWith('tickers.')) {
          const sym   = msg.topic.split('.')[1];
          const price = parseFloat(msg.data?.lastPrice);
          if (price) {
            this.priceCache[sym] = { price, markPrice: parseFloat(msg.data?.markPrice || price), ts: Date.now() };
            this.emit('price', { symbol: sym, price, data: msg.data });
          }
        }

        // Kline
        if (msg.topic.startsWith('kline.')) {
          const parts = msg.topic.split('.');
          const interval = parts[1];
          const sym = parts[2];
          this.klineCache[`${sym}_${interval}`] = msg.data;
          this.emit('kline', { symbol: sym, interval, data: msg.data });
        }
      } catch(e) {}
    });

    this.pubWs.on('close', () => {
      this.isPubConn = false;
      this._stopPing('pub');
      const delay = Math.min(2000 * ++this.pubAttempts, 30000);
      console.log(`[WS:Pub] Reconnecting in ${delay}ms`);
      setTimeout(() => this.connectPublic(), delay);
    });

    this.pubWs.on('error', e => console.error('[WS:Pub]', e.message));
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  connectPrivate() {
    if (this.privWs?.readyState === WebSocket.OPEN) return;
    this.privWs = new WebSocket(this.privUrl);

    this.privWs.on('open', () => {
      const exp = Date.now() + 10000;
      const sig = crypto.createHmac('sha256', process.env.BYBIT_SECRET)
        .update(`GET/realtime${exp}`).digest('hex');
      this.privWs.send(JSON.stringify({
        op: 'auth', args: [process.env.BYBIT_API_KEY, exp, sig]
      }));
    });

    this.privWs.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.op === 'auth' && msg.success) {
          console.log('[WS:Priv] Authenticated');
          this.isPrivConn = true;
          this.privAttempts = 0;
          this._ping(this.privWs, 'priv');
          this.privWs.send(JSON.stringify({ op: 'subscribe', args: ['order', 'execution', 'position'] }));
          this.emit('priv:connected');
        }
        if (msg.topic === 'order')     this.emit('order',     msg.data);
        if (msg.topic === 'execution') this.emit('execution', msg.data);
        if (msg.topic === 'position')  this.emit('position',  msg.data);
      } catch(e) {}
    });

    this.privWs.on('close', () => {
      this.isPrivConn = false;
      this._stopPing('priv');
      const delay = Math.min(2000 * ++this.privAttempts, 30000);
      console.log(`[WS:Priv] Reconnecting in ${delay}ms`);
      setTimeout(() => this.connectPrivate(), delay);
    });

    this.privWs.on('error', e => console.error('[WS:Priv]', e.message));
  }

  // ── Subs ─────────────────────────────────────────────────────────────────────

  subscribeTicker(symbols) {
    const arr = Array.isArray(symbols) ? symbols : [symbols];
    arr.forEach(s => this.pubSubs.add(`tickers.${s}`));
    this._send(this.pubWs, { op: 'subscribe', args: arr.map(s => `tickers.${s}`) });
  }

  subscribeKline(symbol, interval = '1') {
    const topic = `kline.${interval}.${symbol}`;
    this.pubSubs.add(topic);
    this._send(this.pubWs, { op: 'subscribe', args: [topic] });
  }

  _resubscribe() {
    if (this.pubSubs.size > 0)
      this._send(this.pubWs, { op: 'subscribe', args: [...this.pubSubs] });
  }

  _send(ws, obj) {
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify(obj));
  }

  _ping(ws, name) {
    this._stopPing(name);
    this._pings[name] = setInterval(() => {
      this._send(ws, { op: 'ping' });
    }, 20000);
  }

  _stopPing(name) {
    if (this._pings[name]) { clearInterval(this._pings[name]); delete this._pings[name]; }
  }

  // ── Utils ────────────────────────────────────────────────────────────────────

  getPrice(symbol) { return this.priceCache[symbol]?.price || null; }

  getStatus() {
    return {
      public:  this.isPubConn,
      private: this.isPrivConn,
      cachedPrices: Object.keys(this.priceCache).length,
    };
  }

  connectAll() {
    this.connectPublic();
    if (process.env.PAPER_TRADING !== 'true') this.connectPrivate();
  }
}

module.exports = new WSManager();
