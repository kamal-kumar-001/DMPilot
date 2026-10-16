'use client';

import * as React from 'react';
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}
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

export function AdminQueue() {
  const [queues, setQueues] = React.useState<QueueStats[]>([]);
  const [jobs, setJobs] = React.useState<FailedJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [retrying, setRetrying] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      apiRequest<QueueStats[]>('/admin/queues')
        .then((r) => setQueues(Array.isArray(r) ? r : []))
        .catch(() => setQueues([])),
      apiRequest<FailedJob[]>('/admin/failed-jobs')
        .then((r) => setJobs(Array.isArray(r) ? r : []))
        .catch(() => setJobs([])),
    ]).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const retry = async (job: FailedJob) => {
    setRetrying(job.id);
    try {
      await apiRequest(`/admin/failed-jobs/${encodeURIComponent(job.queue)}/${job.id}/retry`, {
        method: 'POST',
      });
      toast.success('Job re-queued');
      setTimeout(load, 800);
    } catch {
      toast.error('Retry failed');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue stats */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Queue Status</h3>
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queues.map((q) => (
              <div
                key={q.name}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {q.name.replace(/_queue$/, '').replace(/_/g, ' ')}
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      q.paused
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {q.paused ? '⏸ Paused' : '▶ Running'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['Waiting', q.waiting, 'text-amber-600'],
                    ['Active', q.active, 'text-emerald-600'],
                    ['Done', q.completed, 'text-slate-700'],
                    ['Failed', q.failed, 'text-rose-600'],
                  ].map(([l, v, c]) => (
                    <div
                      key={String(l)}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
                    >
                      <p className={`text-lg font-black ${c}`}>{v}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failed jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900">Failed Jobs</h3>
            {jobs.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                {jobs.length}
              </span>
            )}
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer"
            title="Refresh jobs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-xs text-slate-500 shadow-xs">
            No failed jobs — all workers healthy ✓
          </div>
        ) : (
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-rose-200/80 rounded-2xl p-4 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{job.name}</span>
                      <span className="text-[9px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {job.queue}
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold">
                        {job.attemptsMade} attempts
                      </span>
                    </div>
                    <p className="text-xs text-rose-700 mt-1 font-mono truncate">
                      {job.failedReason}
                    </p>
                  </div>
                  <button
                    onClick={() => retry(job)}
                    disabled={retrying === job.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition-all flex-shrink-0 cursor-pointer shadow-xs"
                  >
                    {retrying === job.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}{' '}
                    Retry
                  </button>
                </div>

                {/* Collapsible job details payload with clean light background */}
                <details className="group mt-2 border-t border-slate-100 pt-2">
                  <summary className="text-[11px] text-slate-600 font-semibold cursor-pointer hover:text-slate-900 transition-colors select-none">
                    View payload details
                  </summary>
                  <pre className="mt-2 text-[10px] text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-x-auto max-h-48 font-mono">
                    {JSON.stringify(job.data, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
