// src/components/dashboard/EventLog.tsx
'use client';
import { Card, SectionTitle, Badge, Empty } from '../ui';

const typeColor: Record<string, string> = {
  GRID_STARTED:  'green',
  GRID_STOPPED:  'red',
  GRID_PAUSED:   'yellow',
  GRID_RESUMED:  'green',
  GRID_FILL:     'blue',
  STOP_LOSS:     'red',
  default:       'default',
};

export default function EventLog({ events }: { events: any[] }) {
  return (
    <Card>
      <SectionTitle title="System Events" />
      {events.length === 0 ? (
        <Empty msg="No events yet" />
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {events.map((e: any) => (
            <div key={e.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/30 fadein">
              <span className="text-dim font-mono shrink-0">
                {new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge color={typeColor[e.type] || 'default'}>{e.type}</Badge>
              <span className="text-dim truncate">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
