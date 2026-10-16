'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface HealthStatus {
  api: boolean;
  database: boolean;
  redis: boolean;
  status: 'healthy' | 'degraded' | 'down';
  checkedAt: string;
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
      )}
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <span
        className={`ml-auto text-xs font-semibold ${ok ? 'text-emerald-600' : 'text-rose-500'}`}
      >
        {ok ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

export function HealthPanel() {
  const [health, setHealth] = React.useState<HealthStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    fetchWithAuth<HealthStatus>('/monitoring/health')
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const statusColor =
    health?.status === 'healthy'
      ? 'text-emerald-600'
      : health?.status === 'degraded'
        ? 'text-amber-500'
        : 'text-rose-500';

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">System Health</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">Refreshes every 15s</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {health && (
            <span className={`text-xs font-bold uppercase tracking-wider ${statusColor}`}>
              {health.status}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : !health ? (
        <div className="flex items-center gap-2 text-xs text-amber-700 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Health check unavailable — API may be unreachable</span>
        </div>
      ) : (
        <div className="space-y-2">
          <StatusDot ok={health.api} label="API Server" />
          <StatusDot ok={health.database} label="PostgreSQL Database" />
          <StatusDot ok={health.redis} label="Redis / BullMQ" />
          <p className="text-[9px] text-slate-500 pt-1">
            Checked at {new Date(health.checkedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
