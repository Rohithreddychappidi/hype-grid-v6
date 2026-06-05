// src/components/dashboard/StatsRow.tsx
'use client';
import { Stat, Pnl } from '../ui';

export default function StatsRow({ state, tradeStats }: { state: any; tradeStats: any }) {
  const bal      = state?.balance;
  const equity   = parseFloat(bal?.equity   || 0);
  const upnl     = parseFloat(bal?.upnl     || 0);
  const dailyPnl = parseFloat(tradeStats?.today?.pnl || state?.dailyPnl || 0);
  const totalPnl = parseFloat(tradeStats?.total?.pnl || state?.totalPnl || 0);
  const today    = tradeStats?.today || {};
  const total    = tradeStats?.total || {};

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat
        label="Account Equity"
        value={`$${equity.toFixed(2)}`}
        sub={<span className={upnl >= 0 ? 'pos' : 'neg'}>{upnl >= 0 ? '+' : ''}${upnl.toFixed(2)} unrealized</span>}
        color="text-text"
      />
      <Stat
        label="Today PnL"
        value={<Pnl v={dailyPnl} />}
        sub={`${today.trades || 0} fills today`}
        color={dailyPnl >= 0 ? 'text-accent' : 'text-danger'}
      />
      <Stat
        label="Total PnL"
        value={<Pnl v={totalPnl} />}
        sub={`${total.trades || 0} total fills`}
        color={totalPnl >= 0 ? 'text-accent' : 'text-danger'}
      />
      <Stat
        label="Grid Orders"
        value={state?.openOrders || 0}
        sub={`${state?.levels || 0} levels configured`}
        color="text-info"
      />
    </div>
  );
}
