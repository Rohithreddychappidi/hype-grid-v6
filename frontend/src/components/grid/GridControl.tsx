// src/components/grid/GridControl.tsx
'use client';
import { useState } from 'react';
import { Card, SectionTitle, Btn, Input, Badge, Spinner } from '../ui';
import { api } from '@/lib/api';

export default function GridControl({ state, config, onRefresh }: any) {
  const [cfg, setCfg]       = useState(config || {});
  const [loading, setLoading] = useState('');
  const [msg, setMsg]        = useState('');

  const running = state?.running;
  const paused  = state?.paused;
  const paper   = state?.paperMode;

  const act = async (action: string, fn: () => Promise<any>) => {
    setLoading(action);
    setMsg('');
    try {
      await fn();
      onRefresh();
      setMsg(`✅ ${action} successful`);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading('');
    }
  };

  const saveConfig = () => act('Save Config', () => api.updateConfig({
    capital:       parseFloat(cfg.capital),
    levels:        parseInt(cfg.levels),
    leverage:      parseInt(cfg.leverage),
    stop_loss_pct: parseFloat(cfg.stop_loss_pct),
  }));

  return (
    <Card>
      <SectionTitle title="Grid Control">
        <Badge color={paper ? 'yellow' : 'red'}>{paper ? 'PAPER' : 'LIVE'}</Badge>
      </SectionTitle>

      {/* Control buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {!running ? (
          <Btn variant="green" onClick={() => act('Start', api.startGrid)} disabled={!!loading}>
            {loading === 'Start' ? <Spinner /> : '▶'} Start Grid
          </Btn>
        ) : (
          <Btn variant="red" onClick={() => act('Stop', api.stopGrid)} disabled={!!loading}>
            {loading === 'Stop' ? <Spinner /> : '■'} Stop Grid
          </Btn>
        )}

        {running && !paused && (
          <Btn variant="yellow" onClick={() => act('Pause', api.pauseGrid)} disabled={!!loading}>
            ⏸ Pause
          </Btn>
        )}

        {running && paused && (
          <Btn variant="green" onClick={() => act('Resume', api.resumeGrid)} disabled={!!loading}>
            ▶ Resume
          </Btn>
        )}

        {running && (
          <Btn variant="blue" onClick={() => act('Rebuild', api.rebuildGrid)} disabled={!!loading}>
            ↺ Rebuild Grid
          </Btn>
        )}
      </div>

      {/* Config form */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Input
          label="Capital (USDT)"
          type="number"
          value={cfg.capital || ''}
          onChange={(e: any) => setCfg({ ...cfg, capital: e.target.value })}
        />
        <Input
          label="Grid Levels"
          type="number"
          value={cfg.levels || ''}
          onChange={(e: any) => setCfg({ ...cfg, levels: e.target.value })}
        />
        <Input
          label="Leverage (x)"
          type="number"
          value={cfg.leverage || ''}
          onChange={(e: any) => setCfg({ ...cfg, leverage: e.target.value })}
        />
        <Input
          label="Stop Loss (%)"
          type="number"
          value={cfg.stop_loss_pct || ''}
          onChange={(e: any) => setCfg({ ...cfg, stop_loss_pct: e.target.value })}
        />
      </div>

      <Btn variant="default" size="sm" onClick={saveConfig} disabled={!!loading}>
        {loading === 'Save Config' ? <Spinner /> : null} Save Config
      </Btn>

      {msg && <p className="text-xs font-mono mt-2 text-dim">{msg}</p>}
    </Card>
  );
}
