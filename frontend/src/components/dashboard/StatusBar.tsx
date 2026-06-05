// src/components/dashboard/StatusBar.tsx
'use client';
import { Dot } from '../ui';

export default function StatusBar({ status, state }: { status: any; state: any }) {
  const ws      = status?.ws?.public;
  const api     = status?.api?.connected;
  const paper   = status?.paper;
  const running = state?.running;
  const paused  = state?.paused;
  const mode    = state?.market?.mode || 'UNKNOWN';

  const modeColor = mode === 'RANGING' ? 'text-accent' : mode === 'UPTREND' ? 'text-emerald-400' : 'text-danger';
  const gridStatus = !running ? 'STOPPED' : paused ? 'PAUSED' : 'ACTIVE';
  const gridColor  = !running ? 'text-dim' : paused ? 'text-warning' : 'text-accent';

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono bg-surface border border-border rounded-xl px-4 py-2.5">
      <span className="flex items-center gap-1.5">
        <Dot on={api}  /> REST {api  ? 'OK' : 'ERR'}
      </span>
      <span className="flex items-center gap-1.5">
        <Dot on={ws} pulse={ws} /> WS {ws ? 'LIVE' : 'DC'}
      </span>
      <span className={`font-semibold ${gridColor}`}>
        GRID: {gridStatus}
      </span>
      <span className={`font-semibold ${modeColor}`}>
        MARKET: {mode}
      </span>
      {paper && (
        <span className="ml-auto bg-warning/10 text-warning border border-warning/30 px-2 py-0.5 rounded text-xs">
          PAPER MODE
        </span>
      )}
      {!paper && (
        <span className="ml-auto bg-danger/10 text-danger border border-danger/30 px-2 py-0.5 rounded text-xs font-bold">
          ⚡ LIVE
        </span>
      )}
    </div>
  );
}
