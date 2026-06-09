// src/app/page.tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatusBar   from '@/components/dashboard/StatusBar';
import StatsRow    from '@/components/dashboard/StatsRow';
import MarketMode  from '@/components/dashboard/MarketMode';
import PnlChart    from '@/components/dashboard/PnlChart';
import PaperPanel  from '@/components/dashboard/PaperPanel';
import EventLog    from '@/components/dashboard/EventLog';
import GridControl from '@/components/grid/GridControl';
import GridLevels  from '@/components/grid/GridLevels';
import TradeFills  from '@/components/trades/TradeFills';

export default function Dashboard() {
  const [state,       setState]       = useState<any>(null);
  const [status,      setStatus]      = useState<any>(null);
  const [config,      setConfig]      = useState<any>(null);
  const [tradeStats,  setTradeStats]  = useState<any>(null);
  const [trades,      setTrades]      = useState<any[]>([]);
  const [daily,       setDaily]       = useState<any[]>([]);
  const [paper,       setPaper]       = useState<any>(null);
  const [events,      setEvents]      = useState<any[]>([]);
  const [lastUpdate,  setLastUpdate]  = useState('');
  const [tab,         setTab]         = useState<'overview'|'grid'|'trades'>('overview');

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      api.getState(),
      api.getStatus(),
      api.getConfig(),
      api.getTradeStats(),
      api.getTrades(50),
      api.getDailyStats(),
      api.getPaperState(),
      api.getEvents(),
    ]);

    if (results[0].status === 'fulfilled') setState(results[0].value);
    if (results[1].status === 'fulfilled') setStatus(results[1].value);
    if (results[2].status === 'fulfilled') setConfig(results[2].value);
    if (results[3].status === 'fulfilled') setTradeStats(results[3].value);
    if (results[4].status === 'fulfilled') setTrades(results[4].value);
    if (results[5].status === 'fulfilled') setDaily(results[5].value);
    if (results[6].status === 'fulfilled') setPaper(results[6].value);
    if (results[7].status === 'fulfilled') setEvents(results[7].value);
    setLastUpdate(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'grid',     label: 'Grid' },
    { id: 'trades',   label: 'Trades' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="text-sm font-semibold tracking-wider">
              <span className="text-accent font-mono">◈</span> HYPE GRID
            </span>
            <nav className="flex gap-1">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    tab === t.id ? 'bg-accent/10 text-accent' : 'text-dim hover:text-text'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-dim font-mono">
            <span className={state?.running ? (state?.paused ? 'text-warning' : 'text-accent blink') : 'text-dim'}>
              {state?.running ? (state?.paused ? '⏸ PAUSED' : '● RUNNING') : '○ STOPPED'}
            </span>
            <span>{lastUpdate}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Always visible */}
        <StatusBar status={status} state={state} />

        {/* Overview Tab */}
        {tab === 'overview' && (
          <>
            <StatsRow state={state} tradeStats={tradeStats} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <PnlChart daily={daily} />
                <TradeFills trades={trades.slice(0, 10)} />
              </div>
              <div className="space-y-4">
                <MarketMode market={state?.market} currentPrice={state?.currentPrice} />
                <PaperPanel paper={paper} onRefresh={refresh} />
                <EventLog events={events.slice(0, 10)} />
              </div>
            </div>
          </>
        )}

        {/* Grid Tab */}
        {tab === 'grid' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <GridControl state={state} config={config} onRefresh={refresh} />
              <MarketMode market={state?.market} currentPrice={state?.currentPrice} />
            </div>
            <GridLevels state={state} />
          </div>
        )}

        {/* Trades Tab */}
        {tab === 'trades' && (
          <div className="space-y-4">
            <StatsRow state={state} tradeStats={tradeStats} />
            <PnlChart daily={daily} />
            <TradeFills trades={trades} />
          </div>
        )}
      </main>
    </div>
  );
}
