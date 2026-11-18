'use client';

import { Eye } from 'lucide-react';
import { AnalyticsChart } from '@/components/dashboard/analytics-chart';
import { TopPostsCard } from '@/components/analytics/top-posts-card';
import { TopKeywordsCard } from '@/components/analytics/top-keywords-card';
import { DailyUsageChart } from '@/components/analytics/daily-usage-chart';
import { RatesCard } from '@/components/analytics/rates-card';
import { GrowthTable } from '@/components/analytics/growth-table';
import { AccountChips } from '@/components/dashboard/account-chips';

export default function AnalyticsPage() {
  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Results</h1>
          <p className="text-slate-600 text-xs mt-0.5">
            Growth and DM performance across your accounts.
          </p>
        </div>

        <AccountChips />

        {/* Per-account growth with a combined row */}
        <GrowthTable />

        {/* Reach/views need the Instagram insights permission, which the app
            does not request yet: honest empty state, never a zero. */}
        <div className="border border-dashed border-slate-300 rounded-2xl p-5 space-y-1.5 bg-white/50">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-500">Reach and views</h3>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Not tracked yet. This needs the Instagram insights permission and a one-time reconnect
            of each account.
          </p>
        </div>

        {/* Rates + 7-day traffic */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RatesCard />
          <div className="lg:col-span-2">
            <AnalyticsChart />
          </div>
        </div>

        {/* 30-day daily usage */}
        <DailyUsageChart />

        {/* Top Posts + Top Keywords */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopPostsCard />
          <TopKeywordsCard />
        </div>
      </div>
    </>
  );
}
