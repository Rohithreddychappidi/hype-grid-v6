// src/components/dashboard/PnlChart.tsx
'use client';
import { Card, SectionTitle } from '../ui';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function PnlChart({ daily }: { daily: any[] }) {
  const data = [...daily].reverse().map(d => ({
    date:   new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    pnl:    parseFloat(d.pnl || 0),
    trades: parseInt(d.trades || 0),
  }));

  const total  = data.reduce((s, d) => s + d.pnl, 0);
  const isPos  = total >= 0;
  const color  = isPos ? '#00d4aa' : '#ff4757';

  return (
    <Card>
      <SectionTitle title="Daily PnL">
        <span className={`text-sm font-mono font-semibold ${isPos ? 'pos' : 'neg'}`}>
          {isPos ? '+' : ''}${total.toFixed(2)} total
        </span>
      </SectionTitle>
      {data.length === 0 ? (
        <div className="h-28 flex items-center justify-center text-dim text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <ReferenceLine y={0} stroke="#1c2230" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ background: '#0d1117', border: '1px solid #1c2230', borderRadius: 8, fontSize: 11 }}
              itemStyle={{ color: '#e2e8f0' }}
              labelStyle={{ color: '#64748b' }}
              formatter={(v: any) => [`$${parseFloat(v).toFixed(2)}`, 'PnL']}
            />
            <Area type="monotone" dataKey="pnl" stroke={color} strokeWidth={1.5} fill="url(#pnlG)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
