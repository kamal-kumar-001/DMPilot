'use client';

import * as React from 'react';
import { LineChart } from 'lucide-react';
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

  const maxVal = Math.max(1, ...data.flatMap((d) => [d.dmsSent, d.failedDms]));
  const plot = { left: 36, right: 788, top: 12, bottom: 148 };
  const x = (index: number) =>
    data.length === 1
      ? (plot.left + plot.right) / 2
      : plot.left + (index / (data.length - 1)) * (plot.right - plot.left);
  const y = (value: number) => plot.bottom - (value / maxVal) * (plot.bottom - plot.top);
  const points = (pick: (day: DailyUsage) => number) =>
    data.map((day, index) => `${x(index)},${y(pick(day))}`).join(' ');
  const labelStep = Math.max(1, Math.ceil((data.length - 1) / 6));

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-primary" />
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
          <div className="relative">
            <span
              style={{ top: `${(plot.top / 160) * 100}%` }}
              className="absolute left-0 -translate-y-1/2 text-[10px] leading-none text-slate-400"
            >
              {maxVal}
            </span>
            <span
              style={{ top: `${(plot.bottom / 160) * 100}%` }}
              className="absolute left-0 -translate-y-1/2 text-[10px] leading-none text-slate-400"
            >
              0
            </span>
            <svg
              viewBox="0 0 800 160"
              className="h-48 w-full overflow-visible"
              role="img"
              aria-label="Daily DM attempts: accepted by Instagram and send failed"
              preserveAspectRatio="none"
            >
              <title>Daily DM attempts</title>
              <desc>
                Two lines show provider-accepted sends and failed sends. Accepted does not mean
                delivered or read.
              </desc>
              {[0, maxVal].map((value) => (
                <g key={value}>
                  <line
                    x1={plot.left}
                    x2={plot.right}
                    y1={y(value)}
                    y2={y(value)}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                  />
                </g>
              ))}
              <polyline
                points={points((day) => day.dmsSent)}
                fill="none"
                stroke="#00bb88"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={points((day) => day.failedDms)}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeDasharray="5 4"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {data.map((day, index) => (
                <g key={day.date}>
                  <circle cx={x(index)} cy={y(day.dmsSent)} r="3" fill="#00bb88">
                    <title>{`${day.date}: ${day.dmsSent} accepted by Instagram`}</title>
                  </circle>
                  <circle cx={x(index)} cy={y(day.failedDms)} r="3" fill="#f43f5e">
                    <title>{`${day.date}: ${day.failedDms} send failed`}</title>
                  </circle>
                </g>
              ))}
            </svg>
          </div>
          <div
            className={`flex ${data.length === 1 ? 'justify-center' : 'justify-between pl-6'} text-[10px] text-slate-400 font-medium`}
          >
            {data.map((day, index) =>
              index % labelStep === 0 || index === data.length - 1 ? (
                <span key={day.date}>{day.date.slice(5)}</span>
              ) : null,
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Updated when the page loads.</p>
        </>
      )}
    </div>
  );
}
