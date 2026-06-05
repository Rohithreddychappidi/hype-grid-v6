// src/exchanges/bybitClient.js
const axios = require('axios');
const crypto = require('crypto');

class BybitClient {
  constructor() {
    const testnet = process.env.BYBIT_TESTNET === 'true';
    this.baseUrl = testnet
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';
    this.apiKey   = process.env.BYBIT_API_KEY;
    this.secret   = process.env.BYBIT_SECRET;
    this.recvWindow = 5000;
    this.http = axios.create({ baseURL: this.baseUrl, timeout: 10000 });
  }

  _sign(payload, ts) {
    return crypto.createHmac('sha256', this.secret)
      .update(`${ts}${this.apiKey}${this.recvWindow}${payload}`)
      .digest('hex');
  }

  _headers(payload = '') {
    const ts = Date.now().toString();
    return {
      'X-BAPI-API-KEY':      this.apiKey,
      'X-BAPI-TIMESTAMP':    ts,
      'X-BAPI-RECV-WINDOW':  this.recvWindow.toString(),
      'X-BAPI-SIGN':         this._sign(payload, ts),
      'Content-Type':        'application/json',
    };
  }

  async _get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await this.http.get(`${path}?${qs}`, { headers: this._headers(qs) });
    if (res.data.retCode !== 0) throw new Error(res.data.retMsg);
    return res.data.result;
  }

  async _post(path, body = {}) {
    const str = JSON.stringify(body);
    const res = await this.http.post(path, body, { headers: this._headers(str) });
    if (res.data.retCode !== 0) throw new Error(res.data.retMsg);
    return res.data.result;
  }

  // ── Market ──────────────────────────────────────────────────────────────────

  async getPrice(symbol) {
    const res = await this.http.get(`/v5/market/tickers?category=linear&symbol=${symbol}`);
    return parseFloat(res.data.result.list[0]?.lastPrice || 0);
  }

  async getKlines(symbol, interval = '1', limit = 200) {
    const res = await this.http.get(
      `/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    // Returns [time, open, high, low, close, volume] newest first — reverse for chronological
    return (res.data.result.list || []).reverse();
  }

  async getInstrumentInfo(symbol) {
    const res = await this.http.get(`/v5/market/instruments-info?category=linear&symbol=${symbol}`);
    const info = res.data.result.list?.[0];
    return {
      minQty:   parseFloat(info?.lotSizeFilter?.minOrderQty || 0.1),
      qtyStep:  parseFloat(info?.lotSizeFilter?.qtyStep     || 0.1),
      tickSize: parseFloat(info?.priceFilter?.tickSize       || 0.01),
    };
  }

  // ── Account ──────────────────────────────────────────────────────────────────

  async getBalance() {
    const r = await this._get('/v5/account/wallet-balance', { accountType: 'UNIFIED' });
    const acc  = r.list?.[0];
    const usdt = acc?.coin?.find(c => c.coin === 'USDT');
    return {
      equity:    parseFloat(acc?.totalEquity        || 0),
      available: parseFloat(usdt?.availableToWithdraw || 0),
      upnl:      parseFloat(acc?.totalPerpUPL        || 0),
    };
  }

  async setLeverage(symbol, lev) {
    return this._post('/v5/position/set-leverage', {
      category: 'linear', symbol,
      buyLeverage:  lev.toString(),
      sellLeverage: lev.toString(),
    });
  }

  // ── Orders ───────────────────────────────────────────────────────────────────

  async placeLimit(symbol, side, qty, price, linkId) {
    return this._post('/v5/order/create', {
      category: 'linear', symbol,
      side, orderType: 'Limit',
      qty: qty.toString(),
      price: price.toString(),
      timeInForce: 'GTC',
      orderLinkId: linkId,
    });
  }

  async placeMarket(symbol, side, qty, reduceOnly = false) {
    return this._post('/v5/order/create', {
      category: 'linear', symbol,
      side, orderType: 'Market',
      qty: qty.toString(),
      reduceOnly,
    });
  }

  async cancelOrder(symbol, orderId) {
    return this._post('/v5/order/cancel', { category: 'linear', symbol, orderId });
  }

  async cancelAll(symbol) {
    return this._post('/v5/order/cancel-all', { category: 'linear', symbol });
  }

  async getOpenOrders(symbol) {
    const r = await this._get('/v5/order/realtime', { category: 'linear', symbol });
    return r.list || [];
  }

  async ping() {
    try { await this.http.get('/v5/market/time'); return true; }
    catch { return false; }
  }
}

module.exports = new BybitClient();
