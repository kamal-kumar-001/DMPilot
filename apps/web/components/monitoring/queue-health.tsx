'use client';

import * as React from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

function QueueCard({ q }: { q: QueueStats }) {
  const friendlyName = q.name.replace(/_queue$/, '').replace(/_/g, ' ');
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            {friendlyName}
          </h4>
          <span
            className={`text-[9px] font-semibold ${q.paused ? 'text-amber-500' : 'text-emerald-600'}`}
          >
            {q.paused ? '⏸ Paused' : '▶ Running'}
          </span>
        </div>
        {q.failed > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
            {q.failed} failed
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Waiting', val: q.waiting, color: 'text-amber-500' },
          { label: 'Active', val: q.active, color: 'text-emerald-600' },
          { label: 'Done', val: q.completed, color: 'text-slate-700' },
          { label: 'Delayed', val: q.delayed, color: 'text-cyan-600' },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1"
          >
            <span className={`text-lg font-extrabold ${color}`}>{val}</span>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QueueHealth() {
  const [queues, setQueues] = React.useState<QueueStats[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    fetchWithAuth<QueueStats[]>('/monitoring/queues')
      .then((res) => setQueues(Array.isArray(res) ? res : []))
      .catch(() => setQueues([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Queue Health</h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : queues.length === 0 ? (
        <p className="text-xs text-slate-500 p-4 bg-white/80 border border-slate-200/80 rounded-2xl">
          No queues available.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {queues.map((q) => (
            <QueueCard key={q.name} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}
