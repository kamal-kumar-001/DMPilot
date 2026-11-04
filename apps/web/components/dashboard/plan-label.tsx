'use client';
import { useCreatorQuery } from '@/lib/use-creator-query';
import { cn } from '@dmpilot/ui';

/** Display only: roles and feature authorization stay server-owned. */
export function PlanLabel() {
  const { data, isPending, isError } = useCreatorQuery<{ plan: string }>(
    '/billing/subscription',
    30_000,
  );
  const plan =
    !isPending && !isError && ['FREE', 'PRO', 'ENTERPRISE'].includes(data?.plan || '')
      ? data?.plan
      : null;
  const label = isPending
    ? 'Checking plan'
    : plan === 'FREE'
      ? 'Free'
      : plan === 'PRO'
        ? 'Pro'
        : plan === 'ENTERPRISE'
          ? 'Enterprise'
          : 'Plan unavailable';
  return (
    <span
      aria-label={plan ? `Current plan: ${label}` : label}
      title={plan ? `Current plan: ${label}` : label}
      className={cn(
        'mt-0.5 w-fit max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight',
        plan === 'PRO'
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_0_8px_rgba(16,185,129,0.14)]'
          : plan === 'ENTERPRISE'
            ? 'border border-indigo-200 bg-indigo-50 text-indigo-800'
            : 'text-slate-500',
      )}
    >
      {label}
    </span>
  );
}
