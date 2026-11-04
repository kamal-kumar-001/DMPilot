'use client';

import { useCreatorQuery } from './use-creator-query';

export interface AnalyticsSummary {
  totalComments: number;
  totalDmsSent: number;
  successRate: number;
  activeCampaigns: number;
  failedDms: number;
}

export interface ChartDataPoint {
  date: string;
  comments: number;
  messages: number;
}

export interface ActivityItem {
  type: 'comment' | 'dm';
  id: string;
  label: string;
  detail: string;
  success: boolean;
  ts: string;
}

export function useAnalyticsSummary() {
  const q = useCreatorQuery<AnalyticsSummary>('/analytics/summary');
  return { ...q, data: q.data ?? null };
}
export function useAnalyticsChart() {
  const q = useCreatorQuery<ChartDataPoint[]>('/analytics/chart', 60_000);
  return { ...q, data: q.data ?? [] };
}
export function useRecentActivity() {
  const q = useCreatorQuery<ActivityItem[]>('/analytics/activity', 30_000, 30_000);
  return { ...q, data: q.data ?? [] };
}
