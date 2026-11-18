'use client';
import * as React from 'react';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { useCreatorQuery } from '@/lib/use-creator-query';

interface PrivilegedStatus {
  privilegedFlowsEnabled: boolean;
  ownerLevel: boolean;
  accountIds: string[];
}

/**
 * Meta Unified Login (tester-only, unreviewed permissions). Fail closed:
 * hidden behind a lock until the server confirms tester status, with
 * pending-no-flash behavior so members never see a lock jitter.
 */
export function PrivilegedConnectCard() {
  const status = useCreatorQuery<PrivilegedStatus>('/instagram/privileged-status');
  const allowed =
    !status.isPending &&
    !status.isError &&
    status.data?.privilegedFlowsEnabled === true &&
    status.data?.ownerLevel === true;

  const handleUnifiedConnect = async () => {
    const toastId = toast.loading('Connecting...');
    try {
      const data = await apiRequest<{ url: string }>('/instagram/connect?type=unified');
      if (data?.url) {
        toast.success('Redirecting...', { id: toastId });
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL returned');
      }
    } catch (error) {
      toast.error('Connection Failed', {
        id: toastId,
        description: error instanceof Error ? error.message : 'Could not start unified login',
      });
    }
  };

  return (
    <section
      className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-3"
      aria-label="Meta Unified Login access"
    >
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        {status.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : allowed ? (
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        Meta Unified Login (tester access)
      </h3>
      <p role="status" className="text-xs text-slate-600">
        {status.isPending
          ? 'Checking tester access...'
          : status.isError
            ? 'Could not verify tester access.'
            : allowed
              ? 'Your account has Meta tester access. Unified Login uses unreviewed permissions for testing only.'
              : 'Meta Unified Login uses unreviewed permissions and is only available to approved app testers.'}
      </p>
      {status.isError ? (
        <button className="text-sm text-emerald-700 font-bold" onClick={() => status.refetch()}>
          Retry access check
        </button>
      ) : (
        allowed && (
          <button
            onClick={handleUnifiedConnect}
            className="text-xs font-bold gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#1D4ED8] to-[#1E3A8A] text-white border-0 cursor-pointer hover:opacity-90"
          >
            Connect with Meta Unified Login
          </button>
        )
      )}
    </section>
  );
}
