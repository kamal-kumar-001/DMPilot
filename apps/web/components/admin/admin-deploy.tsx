'use client';

import * as React from 'react';
import { Rocket, RotateCcw } from 'lucide-react';
import { toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Safe update control: the owner admin pins an exact approved commit with a
 * typed DEPLOY confirmation. The host watcher (installed separately, with
 * approval) is the only thing that executes it. Status is read-only here.
 */
export function AdminDeploy() {
  const [sha, setSha] = React.useState('');
  const [latest, setLatest] = React.useState<{ sha: string; checkedAt: string } | null>(null);
  const [latestError, setLatestError] = React.useState(false);
  const [checkingLatest, setCheckingLatest] = React.useState(false);
  const checkLatest = async () => {
    setCheckingLatest(true);
    setLatestError(false);
    setLatest(null);
    try {
      const data = await apiRequest<{ sha: string; checkedAt: string }>('/admin/deploy-latest');
      if (!/^[0-9a-f]{40}$/.test(data.sha)) throw new Error('Invalid commit');
      setLatest(data);
      setSha(data.sha);
      setDialogOpen(true);
    } catch {
      setLatestError(true);
    } finally {
      setCheckingLatest(false);
    }
  };
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [acting, setActing] = React.useState(false);

  const submit = async () => {
    setActing(true);
    try {
      await apiRequest('/admin/deploy-requests', {
        method: 'POST',
        body: JSON.stringify({ targetSha: sha.trim(), confirm: 'DEPLOY' }),
      });
      toast.success(
        'Deploy request recorded. Execution requires the separately configured host runner.',
      );
      setDialogOpen(false);
      setSha('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create deploy request.');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl border bg-slate-50 border-slate-200 flex-shrink-0">
            <Rocket className="h-5 w-5 text-slate-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-extrabold text-slate-900">Backend update</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Request a backend update to an exact approved main commit. Only the owner admin
              account can request, one update at a time. The host watcher verifies the commit,
              backup and rollback image before anything runs. This page records requests; execution
              requires a separately installed and tested host runner.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-800">Latest main commit</h3>
            <button
              type="button"
              onClick={checkLatest}
              disabled={checkingLatest}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {checkingLatest ? 'Checking latest...' : 'Update to latest'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            kamal-kumar-001/DMPilot · main. Checked on demand, cached for up to 60 seconds.
          </p>
          {latest && (
            <>
              <code className="block break-all text-xs text-slate-800">{latest.sha}</code>
              <p className="text-[11px] text-slate-500">
                Checked {new Date(latest.checkedAt).toLocaleString()}
              </p>
              <button
                type="button"
                onClick={() => setSha(latest.sha)}
                className="text-xs font-bold text-rose-600"
              >
                Review this exact commit
              </button>
            </>
          )}
          {latestError && (
            <p role="alert" className="text-xs text-rose-600">
              Could not check latest main. Retry or enter a verified full commit ID below.
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            Selecting a commit does not deploy it. Review the exact ID below and confirm your
            request. The host runner must be connected before a request can execute.
          </p>
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-bold text-slate-600">
            Advanced: update a specific commit ID
          </summary>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={sha}
              onChange={(e) => setSha(e.target.value)}
              aria-label="Target commit ID"
              placeholder="Full 40-character approved commit SHA"
              className="w-full sm:flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                disabled={!/^[0-9a-f]{40}$/.test(sha.trim())}
                className="flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center space-x-1.5"
              >
                <Rocket className="h-3.5 w-3.5" />
                <span>Request deploy</span>
              </button>
            </div>
          </div>{' '}
        </details>
      </div>

      <div className="rounded-2xl bg-white/85 border border-slate-200/80 p-5 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">Rollback backend</h3>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-400 cursor-not-allowed"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Rollback
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Not connected yet. A verified previous image and the safe host runner are required. This
          never restores or deletes database data.
        </p>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title="Request backend deploy?"
        description={`This asks the host watcher to update the backend to exactly commit ${sha.trim()}. The watcher verifies the commit is on main, preserves a rollback image and checks the backup before running. This action is audit logged with your identity.`}
        confirmText="DEPLOY"
        confirmButtonLabel="Request deploy"
        loading={acting}
        onConfirm={submit}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
