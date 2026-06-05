// src/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const KEY  = process.env.NEXT_PUBLIC_API_KEY  || '';

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, ...(opts.headers || {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error); }
  return res.json();
}

export const api = {
  getState:      ()           => req('/state'),
  getStatus:     ()           => req('/status'),
  getConfig:     ()           => req('/config'),
  updateConfig:  (d: any)     => req('/config', { method: 'PUT', body: JSON.stringify(d) }),
  getMarket:     ()           => req('/market'),
  getPrice:      (s: string)  => req(`/price?symbol=${s}`),

  startGrid:     ()           => req('/grid/start',   { method: 'POST' }),
  stopGrid:      ()           => req('/grid/stop',    { method: 'POST' }),
  pauseGrid:     ()           => req('/grid/pause',   { method: 'POST' }),
  resumeGrid:    ()           => req('/grid/resume',  { method: 'POST' }),
  rebuildGrid:   ()           => req('/grid/rebuild', { method: 'POST' }),

  getTrades:     (l = 100)    => req(`/trades?limit=${l}`),
  getTradeStats: ()           => req('/trades/stats'),
  getDailyStats: ()           => req('/trades/daily'),

  getPaperState: ()           => req('/paper/state'),
  resetPaper:    (b: number)  => req('/paper/reset', { method: 'POST', body: JSON.stringify({ balance: b }) }),

  getEvents:     ()           => req('/events'),
  getMarketHistory: ()        => req('/market/history'),
};
