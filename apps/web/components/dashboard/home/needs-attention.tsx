'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useCreatorQuery } from '@/lib/use-creator-query';

interface AnalyticsSummary {
  totalComments: number;
  totalDmsSent: number;
  successRate: number;
  activeCampaigns: number;
  failedDms: number;
}

/**
 * Shown only when something needs action: sends that failed in the last 24
 * hours. Renders nothing otherwise. An intentional pause is not an alert.
 */
export function NeedsAttention() {
  const query = useCreatorQuery<AnalyticsSummary>('/analytics/summary');
  const failed24h = query.data?.failedDms ?? 0;

  if (query.loading || query.isError || failed24h === 0) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 shadow-sm"
    >
      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-bold text-amber-900">
          {failed24h} {failed24h === 1 ? 'send' : 'sends'} failed in the last 24 hours
        </p>
        <p className="text-xs text-amber-800/80 font-medium">
          Instagram did not accept these messages.{' '}
          <Link href="/delivery-logs" className="underline font-bold hover:text-amber-900">
            Open the delivery log
          </Link>{' '}
          to see which ones.
        </p>
      </div>
    </div>
  );
}
