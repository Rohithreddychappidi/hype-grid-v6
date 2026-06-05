// src/components/dashboard/MarketMode.tsx
'use client';
import { Card, SectionTitle } from '../ui';

export default function MarketMode({ market }: { market: any }) {
  const mode = market?.mode || 'UNKNOWN';
  const ind  = {
    price:      parseFloat(market?.indicators?.price      || 0),
    adx:        parseFloat(market?.indicators?.adx        || 0),
    rsi:        parseFloat(market?.indicators?.rsi        || 0),
    atrPercent: parseFloat(market?.indicators?.atrPercent || 0),
    ema21:      parseFloat(market?.indicators?.ema21      || 0),
    ema55:      parseFloat(market?.indicators?.ema55      || 0),
  };

  const modeConfig: Record<string, { color: string; bg: string; icon: string; desc: string }> = {
    RANGING:   { color: 'text-accent',       bg: 'bg-accent/10  border-accent/20',  icon: '↔',  desc: 'Grid is ACTIVE — profiting from bounces' },
    UPTREND:   { color: 'text-emerald-400',  bg: 'bg-emerald-400/10 border-emerald-400/20', icon: '↗', desc: 'Grid PAUSED — riding the uptrend' },
    DOWNTREND: { color: 'text-danger',       bg: 'bg-danger/10  border-danger/20',  icon: '↘',  desc: 'Grid PAUSED — riding the downtrend' },
    UNKNOWN:   { color: 'text-dim',          bg: 'bg-muted/10   border-muted/20',   icon: '?',  desc: 'Analyzing market...' },
  };

  const mc = modeConfig[mode] || modeConfig.UNKNOWN;

  return (
    <Card>
      <SectionTitle title="Market Mode" />

      <div className={`border rounded-xl p-4 mb-3 ${mc.bg}`}>
        <div className="flex items-center gap-3">
          <span className={`text-3xl ${mc.color}`}>{mc.icon}</span>
          <div>
            <p className={`text-lg font-bold font-mono ${mc.color}`}>{mode}</p>
            <p className="text-xs text-dim">{mc.desc}</p>
          </div>
        </div>
      </div>

      {/* Indicator values */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {[
        { label: 'Price',  value: ind.price  ? `$${ind.price.toFixed(4)}`        : '—' },
        { label: 'ADX',    value: ind.adx    ? ind.adx.toFixed(1)                : '—', note: ind.adx > 25 ? 'TRENDING' : 'WEAK' },
        { label: 'RSI',    value: ind.rsi    ? ind.rsi.toFixed(1)                : '—', note: ind.rsi > 70 ? 'OVERBOUGHT' : ind.rsi < 30 ? 'OVERSOLD' : 'NEUTRAL' },
        { label: 'ATR %',  value: ind.atrPercent ? `${ind.atrPercent.toFixed(2)}%` : '—' },
        { label: 'EMA 21', value: ind.ema21  ? `$${ind.ema21.toFixed(4)}`        : '—' },
        { label: 'EMA 55', value: ind.ema55  ? `$${ind.ema55.toFixed(4)}`        : '—' },
      ].map(({ label, value, note }) => (
          <div key={label} className="bg-bg border border-border rounded-lg px-3 py-2">
            <span className="text-dim">{label}: </span>
            <span className="text-text">{value}</span>
            {note && <span className="text-dim ml-1 text-[10px]">({note})</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
