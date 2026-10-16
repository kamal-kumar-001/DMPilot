'use client';

import { DashboardLayout } from '@/components/dashboard/layout';
import { AnalyticsChart } from '@/components/dashboard/analytics-chart';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { TopPostsCard } from '@/components/analytics/top-posts-card';
import { TopKeywordsCard } from '@/components/analytics/top-keywords-card';
import { DailyUsageChart } from '@/components/analytics/daily-usage-chart';
import { RatesCard } from '@/components/analytics/rates-card';

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-slate-600 text-xs mt-0.5">
            Real-time performance across all campaigns and accounts.
          </p>
        </div>

        {/* KPI Row */}
        <StatsGrid />

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
    </DashboardLayout>
  );
}
