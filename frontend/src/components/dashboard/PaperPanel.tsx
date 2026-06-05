// src/components/dashboard/PaperPanel.tsx
'use client';
import { useState } from 'react';
import { Card, SectionTitle, Btn, Input, Badge, Pnl } from '../ui';
import { api } from '@/lib/api';

export default function PaperPanel({ paper, onRefresh }: { paper: any; onRefresh: () => void }) {
  const [bal, setBal] = useState('10000');
  const [msg, setMsg] = useState('');

  if (!paper?.enabled) return null;

  const handleReset = async () => {
    try {
      await api.resetPaper(parseFloat(bal));
      onRefresh();
      setMsg('✅ Paper account reset');
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
  };

  const b = {
    equity:    parseFloat(paper?.balance?.equity    || 0),
    available: parseFloat(paper?.balance?.available || 0),
    upnl:      parseFloat(paper?.balance?.totalPnl  || paper?.balance?.upnl || 0),
  };
  const positions = paper.positions || [];

  return (
    <Card>
      <SectionTitle title="Paper Account">
        <Badge color="yellow">SIMULATION</Badge>
      </SectionTitle>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-mono">
        <div className="bg-bg border border-border rounded-lg p-2 text-center">
            <div className="text-dim mb-0.5">Equity</div>
            <div className="text-text">${b.equity.toFixed(2)}</div>
          </div>
          <div className="bg-bg border border-border rounded-lg p-2 text-center">
            <div className="text-dim mb-0.5">Available</div>
            <div className="text-accent">${b.available.toFixed(2)}</div>
          </div>
          <div className="bg-bg border border-border rounded-lg p-2 text-center">
            <div className="text-dim mb-0.5">PnL</div>
            <div className={b.upnl >= 0 ? 'pos' : 'neg'}>
              {b.upnl >= 0 ? '+' : ''}${b.upnl.toFixed(2)}
            </div>
          </div>
      </div>

      {positions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-dim mb-1">Open Positions</p>
          {positions.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs font-mono py-1 border-b border-border/40">
              <span className="text-text">{p.symbol}</span>
              <Badge color={p.side === 'Long' ? 'green' : 'red'}>{p.side}</Badge>
              <span className="text-dim">{p.qty.toFixed(4)}</span>
              <Pnl v={p.upnl} />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="number"
          value={bal}
          onChange={(e: any) => setBal(e.target.value)}
          placeholder="Starting balance"
          className="flex-1"
        />
        <Btn variant="red" size="sm" onClick={handleReset}>Reset</Btn>
      </div>
      {msg && <p className="text-xs font-mono mt-1 text-dim">{msg}</p>}
    </Card>
  );
}
