// src/components/ui/index.tsx
import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-surface border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub, color }: { label: string; value: any; sub?: any; color?: string }) {
  return (
    <Card>
      <p className="text-xs text-dim uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-mono font-semibold ${color || 'text-text'}`}>{value}</p>
      {sub && <p className="text-xs text-dim mt-1">{sub}</p>}
    </Card>
  );
}

export function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    green:   'bg-accent/10   text-accent  border-accent/30',
    red:     'bg-danger/10   text-danger  border-danger/30',
    yellow:  'bg-warning/10  text-warning border-warning/30',
    blue:    'bg-info/10     text-info    border-info/30',
    default: 'bg-muted/20    text-dim     border-muted/30',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${c[color] || c.default}`}>{children}</span>;
}

export function Btn({ children, onClick, variant = 'default', size = 'md', disabled, className = '' }: any) {
  const v: Record<string, string> = {
    default: 'border-border    text-dim     hover:text-text hover:border-muted',
    green:   'border-accent/40 text-accent  hover:bg-accent/10',
    red:     'border-danger/40 text-danger  hover:bg-danger/10',
    yellow:  'border-warning/40 text-warning hover:bg-warning/10',
    blue:    'border-info/40   text-info    hover:bg-info/10',
  };
  const s: Record<string, string> = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-2 text-sm' };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-all ${v[variant]||v.default} ${s[size]} ${disabled?'opacity-40 cursor-not-allowed':''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`w-10 h-5 rounded-full transition-colors relative ${on ? 'bg-accent' : 'bg-muted'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export function Input({ label, ...props }: any) {
  return (
    <div>
      {label && <label className="block text-xs text-dim mb-1">{label}</label>}
      <input {...props} className={`w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-accent/50 ${props.className||''}`} />
    </div>
  );
}

export function Dot({ on, pulse }: { on: boolean; pulse?: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${on ? 'bg-accent' : 'bg-danger'} ${pulse ? 'blink' : ''}`} />;
}

export function Pnl({ v }: { v: number }) {
  const pos = v >= 0;
  return <span className={`font-mono ${pos ? 'pos' : 'neg'}`}>{pos ? '+' : ''}${Math.abs(v).toFixed(2)}</span>;
}

export function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-semibold text-dim uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  );
}

export function Empty({ msg }: { msg: string }) {
  return <div className="text-center text-dim text-sm py-8">{msg}</div>;
}

export function Spinner() {
  return <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />;
}
