'use client';

import * as React from 'react';
import { Rocket, RefreshCw, XCircle } from 'lucide-react';
import { toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { ConfirmDialog } from './confirm-dialog';

interface DeployRequest {
  id: string;
  targetSha: string;
  status: string;
  failureReason: string | null;
  logTail: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/**
 * Safe update control: the owner admin pins an exact approved commit with a
 * typed DEPLOY confirmation. The host watcher (installed separately, with
 * approval) is the only thing that executes it. Status is read-only here.
 */
export function AdminDeploy() {
  const [requests, setRequests] = React.useState<DeployRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [sha, setSha] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [acting, setActing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await apiRequest<DeployRequest[]>('/admin/deploy-requests');
      setRequests(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setActing(true);
    try {
      await apiRequest('/admin/deploy-requests', {
        method: 'POST',
        body: JSON.stringify({ targetSha: sha.trim(), confirm: 'DEPLOY' }),
      });
      toast.success('Deploy request created. The host watcher will pick it up.');
      setDialogOpen(false);
      setSha('');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create deploy request.');
    } finally {
      setActing(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await apiRequest(`/admin/deploy-requests/${id}/cancel`, { method: 'POST' });
      toast.success('Deploy request canceled.');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel.');
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
              backup and rollback image before anything runs; nothing deploys automatically from
              this page.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={sha}
            onChange={(e) => setSha(e.target.value)}
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
            <button
              type="button"
              onClick={load}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 p-6 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3">Request history</h3>
        {loadError ? (
          <p className="text-xs text-rose-600 font-semibold">
            Could not load deploy status. Use refresh to retry.
          </p>
        ) : loading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-xs text-slate-400">No deploy requests yet.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-mono text-slate-700 truncate">
                    {r.targetSha.slice(0, 12)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.failureReason ? ` — ${r.failureReason}` : ''}
                  </p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className="text-[11px] font-bold text-slate-600">{r.status}</span>
                  {(r.status === 'REQUESTED' || r.status === 'AWAITING_APPROVAL') && (
                    <button
                      type="button"
                      onClick={() => cancel(r.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                      title="Cancel request"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
