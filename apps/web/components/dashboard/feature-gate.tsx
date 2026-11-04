'use client';
import * as React from 'react';
import Link from 'next/link';
import { Lock, Loader2 } from 'lucide-react';
import { useFeatureAccess } from '@/lib/use-feature-access';

export function FeatureGate({ feature, label, children }: { feature: string; label: string; children: React.ReactNode }) {
  const access = useFeatureAccess();
  if (access.allowed(feature)) return <>{children}</>;
  return <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 space-y-3" aria-label={`${label} access`}>
    <h2 className="font-bold text-sm flex items-center gap-2">{access.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}{label}</h2>
    <p role="status" className="text-xs text-slate-600">{access.isPending ? 'Checking feature access...' : access.isError ? 'Could not verify feature access.' : 'This feature is not included in your current plan.'}</p>
    {access.isError ? <button className="text-sm text-emerald-700 font-bold" onClick={() => access.refetch()}>Retry access check</button> : !access.isPending && <Link href="/pricing" className="inline-block text-sm text-emerald-700 font-bold">View upgrade options</Link>}
  </section>;
}
