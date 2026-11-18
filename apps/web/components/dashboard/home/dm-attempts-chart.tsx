'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { BarChart2 } from 'lucide-react';
import { useCreatorQuery } from '@/lib/use-creator-query';
import { useAccountFilter } from '@/lib/account-filter';
import { QueryErrorState } from '@/components/analytics/query-error';
import type { PeriodDays } from './period-picker';

interface DailyUsage {
  date: string;
  comments: number;
  dmsSent: number;
  failedDms: number;
}

/**
 * DM attempts per day, split into accepted by Instagram vs send failed. Data
 * is refreshed when the page loads and then served from the shared cache.
 */
export function DmAttemptsChart({ period }: { period: PeriodDays }) {
  const { selectedAccountId } = useAccountFilter();
  const accountParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
  const query = useCreatorQuery<DailyUsage[]>(
    `/analytics/daily-usage?days=${period}${accountParam}`,
    60_000,
  );
  const data = query.data ?? [];

  const maxVal = data.length
    ? Math.max(...data.map((d) => Math.max(d.dmsSent + d.failedDms, 1)), 1)
    : 1;
  const labelStep = Math.ceil(data.length / 7);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">DM attempts per day</h3>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            Accepted by Instagram
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
            Send failed
          </span>
        </div>
      </div>

      {query.loading ? (
        <div className="h-40 rounded-xl bg-slate-50 animate-pulse" />
      ) : query.isError ? (
        <QueryErrorState label="DM attempts" onRetry={() => query.refetch()} />
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-slate-500">
          No DM attempts in this period yet.
        </div>
      ) : (
        <>
          <div className="relative h-40">
            <div className="flex items-end gap-0.5 h-full w-full">
              {data.map((d, i) => {
                const total = d.dmsSent + d.failedDms;
                const acceptedPct = (d.dmsSent / maxVal) * 100;
                const failedPct = (d.failedDms / maxVal) * 100;
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col justify-end h-full group relative"
                    title={`${d.date}: ${d.dmsSent} accepted, ${d.failedDms} failed`}
                  >
                    {d.failedDms > 0 && (
                      <motion.div
                        className="w-full bg-rose-400/80 rounded-t-xs"
                        initial={{ height: 0 }}
                        animate={{ height: `${failedPct}%` }}
                        transition={{ duration: 0.5, delay: i * 0.01 }}
                      />
                    )}
                    <motion.div
                      className={`w-full bg-primary/70 ${d.failedDms > 0 ? '' : 'rounded-t-xs'}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${acceptedPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.01 + 0.05 }}
                    />
                    {total === 0 && <div className="w-full h-px bg-slate-100" />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            {data.map((d, i) =>
              i % labelStep === 0 ? (
                <span key={d.date}>{d.date.slice(5)}</span>
              ) : (
                <span key={d.date} />
              ),
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Updated when the page loads.</p>
        </>
      )}
    </div>
  );
}
