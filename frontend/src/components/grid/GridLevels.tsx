// src/components/grid/GridLevels.tsx
'use client';
import { Card, SectionTitle, Badge, Empty } from '../ui';

export default function GridLevels({ state }: { state: any }) {
  const levels  = state?.gridLevels || [];
  const price   = parseFloat(state?.market?.indicators?.price  || 0);
  const upper   = parseFloat(state?.config?.upper_bound || 0);
  const lower   = parseFloat(state?.config?.lower_bound || 0);
  const spacing = parseFloat(state?.config?.spacing     || 0);

  const open   = levels.filter((l: any) => l.status === 'OPEN');
  const filled = levels.filter((l: any) => l.status === 'FILLED');
  const buys   = open.filter((l: any) => l.side === 'Buy');
  const sells  = open.filter((l: any) => l.side === 'Sell');

  // Sort all levels for display (highest first)
  const sorted = [...levels].sort((a: any, b: any) => b.price - a.price);

  return (
    <Card>
      <SectionTitle title={`Grid Levels (${levels.length})`}>
        <div className="flex gap-2 text-xs">
          <span className="text-accent">{buys.length} buys</span>
          <span className="text-danger">{sells.length} sells</span>
          <span className="text-warning">{filled.length} filled</span>
        </div>
      </SectionTitle>

      {/* Range summary */}
      {upper && lower && (
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-mono">
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-2 text-center">
            <div className="text-dim mb-0.5">Upper</div>
            <div className="text-danger">${upper.toFixed(3)}</div>
          </div>
          <div className="bg-info/10 border border-info/20 rounded-lg p-2 text-center">
            <div className="text-dim mb-0.5">Current</div>
            <div className="text-info">${price.toFixed(3)}</div>
          </div>
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-2 text-center">
            <div className="text-dim mb-0.5">Lower</div>
            <div className="text-accent">${lower.toFixed(3)}</div>
          </div>
        </div>
      )}

      {levels.length === 0 ? (
        <Empty msg="No grid levels. Start the grid to place orders." />
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {sorted.map((level: any, i: number) => {
            const lvlPrice = parseFloat(level.price || 0);
            const pctFromPrice = price ? ((lvlPrice - price) / price * 100) : 0;
            const isFilled = level.status === 'FILLED';

            return (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono
                  ${isFilled ? 'grid-level-fill' :
                    level.side === 'Buy' ? 'grid-level-buy' : 'grid-level-sell'}`}
              >
                <span className="text-dim w-6">#{level.index}</span>
                <span className="text-text">${lvlPrice.toFixed(4)}</span>
                <span className={pctFromPrice >= 0 ? 'text-danger' : 'text-accent'}>
                  {pctFromPrice >= 0 ? '+' : ''}{pctFromPrice.toFixed(2)}%
                </span>
                <Badge color={isFilled ? 'yellow' : level.side === 'Buy' ? 'green' : 'red'}>
                  {isFilled ? 'FILLED' : level.side?.toUpperCase()}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
