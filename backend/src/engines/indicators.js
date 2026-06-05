// src/engines/indicators.js
// Pure functions — no dependencies

function ema(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let val = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    val = prices[i] * k + val * (1 - k);
  }
  return val;
}

function rsi(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const ag = gains / period;
  const al = losses / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function atr(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function adx(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) return { adx: 20, diPlus: 20, diMinus: 20 };

  const dmPlus  = [];
  const dmMinus = [];
  const trs     = [];

  for (let i = 1; i < closes.length; i++) {
    const upMove   = highs[i]  - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  const smooth = (arr, p) => {
    let s = arr.slice(0, p).reduce((a, b) => a + b, 0);
    const result = [s];
    for (let i = p; i < arr.length; i++) {
      s = s - s / p + arr[i];
      result.push(s);
    }
    return result;
  };

  const sTr  = smooth(trs, period);
  const sDmp = smooth(dmPlus, period);
  const sDmm = smooth(dmMinus, period);

  const diP = sDmp.map((v, i) => sTr[i] > 0 ? (v / sTr[i]) * 100 : 0);
  const diM = sDmm.map((v, i) => sTr[i] > 0 ? (v / sTr[i]) * 100 : 0);
  const dx  = diP.map((v, i) => {
    const sum = v + diM[i];
    return sum > 0 ? (Math.abs(v - diM[i]) / sum) * 100 : 0;
  });

  const adxVal = dx.slice(-period).reduce((a, b) => a + b, 0) / period;

  return {
    adx:      adxVal,
    diPlus:   diP[diP.length - 1],
    diMinus:  diM[diM.length - 1],
  };
}

function macd(prices, fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow + signal) return { macd: 0, signal: 0, hist: 0 };
  const fastEma  = ema(prices, fast);
  const slowEma  = ema(prices, slow);
  const macdLine = fastEma - slowEma;
  // Simplified: use last N macd values for signal
  const macdValues = [];
  for (let i = slow; i <= prices.length; i++) {
    const fe = ema(prices.slice(0, i), fast);
    const se = ema(prices.slice(0, i), slow);
    if (fe && se) macdValues.push(fe - se);
  }
  const signalLine = ema(macdValues, signal) || 0;
  return {
    macd:   macdLine,
    signal: signalLine,
    hist:   macdLine - signalLine,
  };
}

module.exports = { ema, rsi, atr, adx, macd };
