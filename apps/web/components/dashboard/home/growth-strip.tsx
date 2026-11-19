'use client';

import * as React from 'react';
import Link from 'next/link';
import { Users, TrendingUp, Eye, ImageIcon } from 'lucide-react';
import { useCreatorQuery } from '@/lib/use-creator-query';
import { useAccountFilter, type FilterableAccount } from '@/lib/account-filter';

interface ContentPost {
  id: string;
  status: string;
  publishedAt?: string | null;
  createdAt?: string | null;
}

function StripItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-[140px] space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
      <div className="text-sm font-bold text-slate-900">{children}</div>
    </div>
  );
}

/**
 * Compact growth strip below the account picker on Home. Follower counts come from the
 * connected accounts and are added together (not unique people). Follower
 * change and views are not tracked yet and say so. Content links to Studio.
 */
export function GrowthStrip() {
  const { accounts, loading } = useAccountFilter();
  const postsQuery = useCreatorQuery<ContentPost[]>('/content', 60_000);

  const totalFollowers = accounts.reduce(
    (sum, account: FilterableAccount) => sum + (account.followersCount ?? 0),
    0,
  );

  const publishedThisWeek = React.useMemo(() => {
    const posts = postsQuery.data;
    if (!posts) return null;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return posts.filter((post) => {
      if (post.status !== 'PUBLISHED') return false;
      const ts = post.publishedAt ?? post.createdAt;
      return ts ? new Date(ts).getTime() >= weekAgo : false;
    }).length;
  }, [postsQuery.data]);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-sm">
      <div className="flex flex-wrap gap-4">
        <StripItem icon={Users} label="Followers · combined">
          {loading ? (
            <span className="inline-block h-4 w-12 rounded bg-slate-100 animate-pulse" />
          ) : (
            <>
              {totalFollowers.toLocaleString()}
              <span className="block text-[10px] font-medium text-slate-400">
                Counts added together, not unique people.
              </span>
            </>
          )}
        </StripItem>
        <StripItem icon={TrendingUp} label="Follower change">
          <span className="text-slate-400">Not tracked yet</span>
        </StripItem>
        <StripItem icon={Eye} label="Views">
          <span className="text-slate-400">Not tracked yet</span>
        </StripItem>
        <StripItem icon={ImageIcon} label="Content">
          {publishedThisWeek !== null ? (
            <>
              {publishedThisWeek} published this week
              <span className="mx-1 text-slate-300">·</span>
            </>
          ) : null}
          <Link href="/publish" className="text-primary hover:underline">
            Open Studio
          </Link>
        </StripItem>
      </div>
    </div>
  );
}
