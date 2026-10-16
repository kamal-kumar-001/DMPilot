'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { BarChart2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface DailyUsage {
  date: string;
  comments: number;
  dmsSent: number;
  failedDms: number;
}

export function DailyUsageChart() {
  const [data, setData] = React.useState<DailyUsage[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchWithAuth<DailyUsage[]>('/analytics/daily-usage?days=30')
      .then((r) => setData(Array.isArray(r) ? r : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const maxVal = data.length ? Math.max(...data.map((d) => Math.max(d.comments, d.dmsSent)), 1) : 1;

  // Show only every 5th label to avoid crowding
  const labelStep = Math.ceil(data.length / 7);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">30-Day Daily Usage</h3>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            Comments
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-accent-cyan inline-block" />
            DMs Sent
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
            Failed
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-slate-50 animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-slate-500">
          No usage data yet.
        </div>
      ) : (
        <div className="relative h-40">
          <div className="flex items-end gap-0.5 h-full w-full">
            {data.map((d, i) => (
              <div key={d.date} className="flex-1 flex items-end gap-px h-full group relative">
                {/* Comment bar */}
                <motion.div
                  className="flex-1 bg-primary/70 rounded-t-xs"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.comments / maxVal) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.01 }}
                />
                {/* DMs bar */}
                <motion.div
                  className="flex-1 bg-accent-cyan/70 rounded-t-xs"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.dmsSent / maxVal) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.01 + 0.05 }}
                />
                {/* Failed bar */}
                {d.failedDms > 0 && (
                  <motion.div
                    className="flex-1 bg-rose-400/80 rounded-t-xs"
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.failedDms / maxVal) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.01 + 0.1 }}
                  />
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 bg-white border border-slate-200 rounded-xl p-2.5 text-[9px] text-slate-900 whitespace-nowrap space-y-0.5 shadow-lg">
                  <p className="font-bold text-slate-700">{d.date}</p>
                  <p className="text-emerald-600 font-semibold">Comments: {d.comments}</p>
                  <p className="text-cyan-600 font-semibold">DMs: {d.dmsSent}</p>
                  {d.failedDms > 0 && (
                    <p className="text-rose-600 font-semibold">Failed: {d.failedDms}</p>
                  )}
                </div>
                {/* X-axis label */}
                {i % labelStep === 0 && (
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 font-medium">
                    {d.date.slice(5)}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5" />
        </div>
      )}
    </div>
  );
}
