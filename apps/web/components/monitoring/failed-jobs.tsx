'use client';

import * as React from 'react';
import { Loader2, RotateCcw, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@autodm/ui';
import { fetchWithAuth } from '@/lib/api-client';
import { CustomSelect } from '../ui/custom-select';

interface FailedJob {
  id: string;
  queue: string;
  name: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  finishedOn?: number;
}

export function FailedJobs() {
  const [jobs, setJobs] = React.useState<FailedJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [retrying, setRetrying] = React.useState<string | null>(null);
  const [deleteTimeframe, setDeleteTimeframe] = React.useState<string>('all');
  const [actionLoading, setActionLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetchWithAuth<FailedJob[]>('/monitoring/failed-jobs')
      .then((res) => setJobs(Array.isArray(res) ? res : []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRetry = async (job: FailedJob) => {
    setRetrying(job.id);
    try {
      const encodedQueue = encodeURIComponent(job.queue);
      await fetchWithAuth('/monitoring/failed-jobs/' + encodedQueue + '/' + job.id + '/retry', {
        method: 'POST',
      });
      toast.success('Job re-queued', {
        description: 'Job ' + job.id.slice(0, 8) + '… added back to ' + job.queue,
      });
      setTimeout(load, 800);
    } catch {
      toast.error('Retry failed', { description: 'Could not re-queue job.' });
    } finally {
      setRetrying(null);
    }
  };

  const purgeFailedJobs = async () => {
    const confirmText =
      deleteTimeframe === 'all'
        ? 'Are you sure you want to delete ALL failed jobs?'
        : 'Delete failed jobs older than ' + deleteTimeframe + '?';

    if (!confirm(confirmText)) return;

    setActionLoading(true);
    const toastId = toast.loading('Deleting failed jobs...');
    try {
      const res = await fetchWithAuth<{ count: number }>(
        '/monitoring/failed-jobs?olderThan=' + deleteTimeframe,
        { method: 'DELETE' },
      );
      toast.success('Deleted ' + res.count + ' failed jobs (' + deleteTimeframe + ')', {
        id: toastId,
      });
      load();
    } catch {
      toast.error('Failed to delete failed jobs', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900">Failed Jobs Queue</h3>
          {jobs.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
              {jobs.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}

          {/* Refresh Button */}
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
            title="Refresh Failed Jobs List"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>

          {/* Timeframe Delete Selector with CustomSelect */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 space-x-1.5">
            <CustomSelect
              value={deleteTimeframe}
              onChange={(val) => setDeleteTimeframe(val)}
              className="w-36"
              options={[
                { value: 'all', label: 'All Failed' },
                { value: '24h', label: 'Older than 24h' },
                { value: '7d', label: 'Older than 7d' },
                { value: '30d', label: 'Older than 30d' },
              ]}
            />
            <button
              onClick={purgeFailedJobs}
              disabled={actionLoading || jobs.length === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="space-y-2 py-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 space-y-1">
          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-2 font-bold">
            ✓
          </div>
          <p className="font-semibold text-slate-700">No failed jobs in queue</p>
          <p className="text-[11px] text-slate-400">
            All background workers are executing cleanly.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{job.name}</span>
                    <span className="text-[9px] text-slate-600 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {job.queue.replace(/_queue$/, '')}
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">
                      {job.attemptsMade} attempts
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-1 font-mono truncate">
                    {job.failedReason}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {job.finishedOn
                      ? new Date(job.finishedOn).toLocaleString()
                      : new Date(job.timestamp).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => handleRetry(job)}
                  disabled={retrying === job.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-all flex-shrink-0 cursor-pointer shadow-xs"
                >
                  {retrying === job.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Retry
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
