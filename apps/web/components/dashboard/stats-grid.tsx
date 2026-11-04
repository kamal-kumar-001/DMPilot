'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Minus,
  Zap,
  Percent,
  Layers,
  Instagram,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { useAnalyticsSummary } from '@/lib/use-analytics';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from '@dmpilot/ui';

export function StatsGrid() {
  const { data, loading, error } = useAnalyticsSummary();
  const client = useQueryClient();
  const { data: session } = useSession();
  const [refreshing, setRefreshing] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const refreshMetrics = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setFeedback('Refreshing metrics...');
    const toastId = 'dashboard-metrics-refresh';
    toast.loading('Refreshing metrics...', { id: toastId });
    try {
      const queries = client.getQueryCache().findAll({
        predicate: (query) =>
          query.queryKey[0] === 'creator' &&
          query.queryKey[1] === session?.user?.id &&
          String(query.queryKey[2]).startsWith('/analytics/'),
        type: 'active',
      });
      const results = await Promise.allSettled(
        queries.map((query) =>
          client.refetchQueries({ queryKey: query.queryKey, exact: true }, { throwOnError: true }),
        ),
      );
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Metrics refresh failed');
      setFeedback('Metrics refreshed.');
      toast.success('Metrics refreshed', { id: toastId });
    } catch {
      setFeedback('Could not refresh metrics. Please try again.');
      toast.error('Could not refresh metrics. Please try again.', { id: toastId });
    } finally {
      setRefreshing(false);
    }
  };

  // No fabricated values when the account summary is unavailable.
  const stats = React.useMemo(() => {
    const dmsSent = data?.totalDmsSent ?? 0;
    const rate = data?.successRate ?? 100;
    const campaigns = data?.activeCampaigns ?? 0;
    const comments = data?.totalComments ?? 0;
    const failed = data?.failedDms ?? 0;

    return [
      {
        title: 'Total Automated Replies',
        value: dmsSent.toLocaleString(),
        change: '+live',
        trend: 'up' as const,
        description: 'DMs sent by automation',
        icon: <Zap className="h-4 w-4 text-primary" />,
      },
      {
        title: 'Response Conversion Rate',
        value: `${rate}%`,
        change: rate >= 95 ? '+high' : failed > 0 ? '-failures' : '0',
        trend: rate >= 95 ? ('up' as const) : failed > 0 ? ('down' as const) : ('neutral' as const),
        description: 'Successful DM delivery rate',
        icon: <Percent className="h-4 w-4 text-accent-cyan" />,
      },
      {
        title: 'Active Campaigns',
        value: campaigns.toLocaleString(),
        change: campaigns > 0 ? '+running' : '0',
        trend: campaigns > 0 ? ('up' as const) : ('neutral' as const),
        description: 'Currently active automations',
        icon: <Layers className="h-4 w-4 text-amber-400" />,
      },
      {
        title: 'Comments Received',
        value: comments.toLocaleString(),
        change: '+live',
        trend: 'up' as const,
        description: 'Total comments on monitored posts',
        icon: <MessageSquare className="h-4 w-4 text-pink-500" />,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={refreshMetrics}
          disabled={loading || refreshing}
          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          title="Refresh summary metrics"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`}
          />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {feedback || (error ? 'Metrics unavailable. Refresh to try again.' : '')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative group overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                {stat.title}
              </span>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                {stat.icon ?? <Instagram className="h-4 w-4 text-pink-500" />}
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              {loading ? (
                <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {!data ? 'Unavailable' : stat.value}
                </span>
              )}
              <span
                className={`text-xs font-semibold flex items-center space-x-0.5 ${
                  stat.trend === 'up'
                    ? 'text-emerald-600 font-bold'
                    : stat.trend === 'down'
                      ? 'text-rose-600 font-bold'
                      : 'text-slate-500'
                }`}
              >
                {stat.trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {stat.trend === 'neutral' && <Minus className="h-3 w-3" />}
                <span>{loading || !data ? '' : stat.change === '0' ? 'stable' : stat.change}</span>
              </span>
            </div>

            <p className="text-[10px] text-slate-500 mt-1">{stat.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
