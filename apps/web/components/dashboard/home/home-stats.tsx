'use client';

import * as React from 'react';
import { Send, AlertTriangle, MessageSquare, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { useCreatorQuery } from '@/lib/use-creator-query';
import { useAccountFilter } from '@/lib/account-filter';
import { useFeatureAccess } from '@/lib/use-feature-access';
import { QueryErrorState } from '@/components/analytics/query-error';
import type { PeriodDays } from './period-picker';

interface DailyUsage {
  date: string;
  comments: number;
  dmsSent: number;
  failedDms: number;
}

function sum(rows: DailyUsage[], pick: (row: DailyUsage) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function Delta({
  current,
  previous,
  period,
}: {
  current: number;
  previous: number;
  period: number;
}) {
  const change = current - previous;
  if (change === 0) {
    return (
      <span className="text-[11px] font-semibold text-slate-400">
        no change vs previous {period}d
      </span>
    );
  }
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold ${up ? 'text-emerald-600' : 'text-rose-500'}`}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {change} vs previous {period}d
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-7 w-16 rounded bg-slate-100 animate-pulse" />
      ) : (
        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</div>
      )}
      {!loading && sub && <div>{sub}</div>}
    </div>
  );
}

interface AnalyticsSummary {
  totalComments: number;
  totalDmsSent: number;
  successRate: number;
  activeCampaigns: number;
  failedDms: number;
}

/**
 * Free-tier variant: the advanced daily-usage endpoint is gated, so these
 * cards read the ungated summary endpoint and honestly label their real
 * range (last 24 hours). No fabricated deltas.
 */
function FreeHomeStats() {
  const { selectedAccountId } = useAccountFilter();
  const accountParam = selectedAccountId ? `?accountId=${selectedAccountId}` : '';
  const query = useCreatorQuery<AnalyticsSummary>(`/analytics/summary${accountParam}`);
  const data = query.data;

  if (query.isError) {
    return (
      <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <QueryErrorState label="home stats" onRetry={() => query.refetch()} />
      </div>
    );
  }

  const attempts = (data?.totalDmsSent ?? 0) + (data?.failedDms ?? 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Send} label="DM attempts" value={attempts} loading={query.loading} />
        <StatCard
          icon={AlertTriangle}
          label="DMs failed"
          value={data?.failedDms ?? 0}
          loading={query.loading}
          sub={
            <p className="text-[11px] text-slate-400 font-medium">
              {data?.totalDmsSent ?? 0} accepted by Instagram
            </p>
          }
        />
        <StatCard
          icon={MessageSquare}
          label="Comments matched"
          value={data?.totalComments ?? 0}
          loading={query.loading}
        />
        <StatCard
          icon={Clock}
          label="Waiting for a reply"
          value={<span className="text-base font-bold text-slate-400">Not tracked yet</span>}
          loading={false}
          sub={
            <p className="text-[11px] text-slate-400 font-medium">
              We can&apos;t reliably tell which threads still need your reply yet.
            </p>
          }
        />
      </div>
      <p className="text-[11px] text-slate-400 font-medium">
        Last 24 hours. Longer periods and comparisons are part of advanced analytics.
      </p>
    </div>
  );
}

/**
 * The four DM-first Home numbers. All come from real message/comment rows via
 * the daily-usage endpoint; the delta compares the selected period with the
 * equally long period before it. "Waiting for a reply" has no reliable thread
 * attribution yet, so it honestly shows Not tracked yet instead of a number.
 * Plans without advanced analytics get the 24-hour summary variant instead.
 */
export function HomeStats({ period }: { period: PeriodDays }) {
  const access = useFeatureAccess();
  // Resolved denial only: while the entitlement check is pending or errored
  // we render the advanced path, exactly like the lock-icon pattern.
  if (access.denied('ANALYTICS_ADVANCED')) {
    return <FreeHomeStats />;
  }
  return <AdvancedHomeStats period={period} />;
}

function AdvancedHomeStats({ period }: { period: PeriodDays }) {
  const { selectedAccountId } = useAccountFilter();
  const accountParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
  const query = useCreatorQuery<DailyUsage[]>(
    `/analytics/daily-usage?days=${period * 2}${accountParam}`,
    60_000,
  );

  const rows = query.data ?? [];
  const current = rows.slice(-period);
  const previous = rows.slice(0, period);

  const attempts = sum(current, (r) => r.dmsSent + r.failedDms);
  const prevAttempts = sum(previous, (r) => r.dmsSent + r.failedDms);
  const failed = sum(current, (r) => r.failedDms);
  const prevFailed = sum(previous, (r) => r.failedDms);
  const accepted = sum(current, (r) => r.dmsSent);
  const commentsMatched = sum(current, (r) => r.comments);
  const prevCommentsMatched = sum(previous, (r) => r.comments);

  if (query.isError) {
    return (
      <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <QueryErrorState label="home stats" onRetry={() => query.refetch()} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Send}
        label="DM attempts"
        value={attempts}
        loading={query.loading}
        sub={<Delta current={attempts} previous={prevAttempts} period={period} />}
      />
      <StatCard
        icon={AlertTriangle}
        label="DMs failed"
        value={failed}
        loading={query.loading}
        sub={
          <div className="space-y-0.5">
            <Delta current={failed} previous={prevFailed} period={period} />
            <p className="text-[11px] text-slate-400 font-medium">
              {accepted} accepted by Instagram
            </p>
          </div>
        }
      />
      <StatCard
        icon={MessageSquare}
        label="Comments matched"
        value={commentsMatched}
        loading={query.loading}
        sub={<Delta current={commentsMatched} previous={prevCommentsMatched} period={period} />}
      />
      <StatCard
        icon={Clock}
        label="Waiting for a reply"
        value={<span className="text-base font-bold text-slate-400">Not tracked yet</span>}
        loading={false}
        sub={
          <p className="text-[11px] text-slate-400 font-medium">
            We can&apos;t reliably tell which threads still need your reply yet.
          </p>
        }
      />
    </div>
  );
}
