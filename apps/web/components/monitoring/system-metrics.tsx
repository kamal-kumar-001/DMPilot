'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Cpu, HardDrive, Clock, Hash } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface SystemMetrics {
  uptimeSeconds: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  nodeVersion: string;
  pid: number;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function MetricBar({
  label,
  value,
  max,
  unit,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-xs text-slate-600">{label}</span>
        </div>
        <span className="text-xs font-bold text-slate-900">
          {value}
          {unit}{' '}
          <span className="text-slate-400 font-normal">
            / {max}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${pct > 85 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-600'}`}
        />
      </div>
    </div>
  );
}

export function SystemMetricsPanel() {
  const [metrics, setMetrics] = React.useState<SystemMetrics | null>(null);

  const load = React.useCallback(() => {
    fetchWithAuth<SystemMetrics>('/monitoring/metrics')
      .then((res) => (typeof res?.uptimeSeconds === 'number' ? setMetrics(res) : null))
      .catch(() => null);
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-900">System Metrics</h3>

      {!metrics ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-8 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <MetricBar
            label="Memory (RSS)"
            value={metrics.memoryUsedMB}
            max={metrics.memoryTotalMB}
            unit=" MB"
            icon={HardDrive}
            color="text-cyan-600"
          />

          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              {
                icon: Clock,
                label: 'Uptime',
                value: formatUptime(metrics.uptimeSeconds),
                color: 'text-emerald-600',
              },
              { icon: Hash, label: 'PID', value: String(metrics.pid), color: 'text-amber-500' },
              { icon: Cpu, label: 'Node', value: metrics.nodeVersion, color: 'text-purple-600' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-center space-y-1"
              >
                <Icon className={`h-4 w-4 mx-auto ${color}`} />
                <p className="text-[10px] font-bold text-slate-900">{value}</p>
                <p className="text-[9px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
