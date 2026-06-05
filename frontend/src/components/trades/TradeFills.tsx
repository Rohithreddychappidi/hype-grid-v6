// src/components/trades/TradeFills.tsx
'use client';
import { Card, SectionTitle, Badge, Pnl, Empty } from '../ui';

export default function TradeFills({ trades }: { trades: any[] }) {
  return (
    <Card>
      <SectionTitle title={`Recent Fills (${trades.length})`} />
      {trades.length === 0 ? (
        <Empty msg="No fills yet. Grid needs to be active." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-dim border-b border-border">
                {['Time', 'Side', 'Price', 'Qty', 'Est. PnL', 'Level'].map(h => (
                  <th key={h} className={`pb-2 font-medium ${h === 'Time' || h === 'Side' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t: any) => {
                const entryPrice = parseFloat(t.entry_price || 0);
                const qty        = parseFloat(t.qty         || 0);
                const pnl        = parseFloat(t.pnl         || 0);
                return (
                <tr key={t.id} className="border-b border-border/40 hover:bg-white/[0.015] fadein">
                  <td className="py-2 text-dim font-mono">
                    {new Date(t.opened_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2">
                    <Badge color={t.side === 'Buy' ? 'green' : 'red'}>{t.side?.toUpperCase()}</Badge>
                  </td>
                  <td className="py-2 text-right font-mono text-text">${entryPrice.toFixed(4)}</td>
                  <td className="py-2 text-right font-mono text-dim">{qty.toFixed(4)}</td>
                  <td className="py-2 text-right font-mono">
                    {t.pnl != null ? <Pnl v={pnl} /> : '—'}
                  </td>
                  <td className="py-2 text-right font-mono text-dim">#{t.level_index ?? '—'}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
