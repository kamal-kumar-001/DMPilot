'use client';

import * as React from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Trash2,
  ShieldAlert,
  Copy,
  Info,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from '@autodm/ui';
import { fetchWithAuth } from '@/lib/api-client';
import { CustomSelect } from '../ui/custom-select';

export interface WebhookLog {
  id: string;
  eventId: string | null;
  provider: string;
  commentId: string | null;
  username: string | null;
  senderId: string | null;
  status: string;
  errorMessage: string | null;
  fbtraceId: string | null;
  payload: any;
  createdAt: string;
  updatedAt: string;
}

interface LogsResponse {
  logs: WebhookLog[];
  total: number;
  page: number;
  limit: number;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PROCESSED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    FAILED: 'bg-rose-50 text-rose-800 border-rose-200',
    PAUSED: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const cls = map[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={
        'px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ' + cls
      }
    >
      {status}
    </span>
  );
}

export function WebhookLogs() {
  const [data, setData] = React.useState<LogsResponse | null>(null);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [isPaused, setIsPaused] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [deleteTimeframe, setDeleteTimeframe] = React.useState<string>('all');
  const [selectedLog, setSelectedLog] = React.useState<WebhookLog | null>(null);

  const load = React.useCallback((p: number) => {
    setLoading(true);
    fetchWithAuth<LogsResponse>('/monitoring/webhook-logs?page=' + p + '&limit=15')
      .then((res) => setData(res && Array.isArray(res.logs) ? res : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const fetchStatus = () => {
    fetchWithAuth<{ paused: boolean }>('/monitoring/webhook-status')
      .then((res) => setIsPaused(res?.paused || false))
      .catch((e) => console.error(e));
  };

  React.useEffect(() => {
    load(page);
    fetchStatus();
  }, [page, load]);

  const togglePause = async () => {
    setActionLoading(true);
    const toastId = toast.loading((isPaused ? 'Resuming' : 'Pausing') + ' webhooks...');
    try {
      const res = await fetchWithAuth<{ paused: boolean }>('/monitoring/webhook-status', {
        method: 'POST',
        body: JSON.stringify({ paused: !isPaused }),
      });
      setIsPaused(res.paused);
      toast.success('Webhooks ' + (res.paused ? 'paused' : 'resumed') + ' successfully', {
        id: toastId,
      });
    } catch {
      toast.error('Failed to update webhook status', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const purgeLogs = async () => {
    const confirm = window.confirm(
      'Are you sure you want to delete ' +
        (deleteTimeframe === 'all' ? 'ALL' : deleteTimeframe) +
        ' webhook logs?',
    );
    if (!confirm) return;

    setActionLoading(true);
    const toastId = toast.loading('Deleting logs...');
    try {
      await fetchWithAuth('/monitoring/webhook-logs?timeframe=' + deleteTimeframe, {
        method: 'DELETE',
      });
      toast.success('Webhook logs deleted successfully', { id: toastId });
      load(1);
      setPage(1);
    } catch {
      toast.error('Failed to delete webhook logs', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(label + ' copied to clipboard!');
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="text-base font-extrabold text-slate-900">
              Webhook Audit & Failure Logs
            </h3>
            {isPaused && (
              <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                PAUSED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Live execution status, Meta error codes, and fbtrace_id correlation table.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Webhook Logs Button */}
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            title="Refresh Webhook Audit Logs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>

          {/* Pause / Resume Button */}
          <button
            onClick={togglePause}
            disabled={actionLoading}
            className={
              isPaused
                ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer border bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer border bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Pause className="w-3.5 h-3.5 text-slate-500" />
            )}
            {isPaused ? 'Resume Webhooks' : 'Pause Webhooks'}
          </button>

          {/* Timeframe Purge Selector with CustomSelect */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 space-x-1.5">
            <CustomSelect
              value={deleteTimeframe}
              onChange={(val) => setDeleteTimeframe(val)}
              className="w-36"
              options={[
                { value: 'all', label: 'All Logs' },
                { value: '24h', label: 'Older than 24h' },
                { value: '7d', label: 'Older than 7d' },
                { value: '30d', label: 'Older than 30d' },
              ]}
            />
            <button
              onClick={purgeLogs}
              disabled={actionLoading}
              title="Delete selected logs"
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* 2. Webhook Log Table */}
      <div className="overflow-x-auto scrollbar-none rounded-xl border border-slate-200">
        <table className="w-full text-xs border-collapse min-w-[750px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider">
              <th className="text-left py-3 px-4">Time</th>
              <th className="text-left py-3 px-4">Provider</th>
              <th className="text-left py-3 px-4">User</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Error / Diagnosis</th>
              <th className="text-left py-3 px-4">Trace ID</th>
              <th className="text-right py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="py-4 px-4 text-center">
                    <div className="h-4 bg-slate-100 rounded animate-pulse w-full max-w-md mx-auto" />
                  </td>
                </tr>
              ))
            ) : !data || data.logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  <Info className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  No webhook audit events found.
                </td>
              </tr>
            ) : (
              data.logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px] font-mono">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{log.provider}</td>
                  <td className="py-3 px-4">
                    {log.username ? (
                      <span className="font-semibold text-slate-900">@{log.username}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{statusBadge(log.status)}</td>
                  <td className="py-3 px-4 max-w-xs">
                    {log.errorMessage ? (
                      <span
                        className="text-rose-600 font-mono text-[11px] truncate block"
                        title={log.errorMessage}
                      >
                        {log.errorMessage}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-[11px]">✓ No error</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {log.fbtraceId ? (
                      <button
                        onClick={() => copyToClipboard(log.fbtraceId!, 'Trace ID')}
                        className="hover:underline text-cyan-700 flex items-center gap-1 cursor-pointer font-bold"
                        title="Click to copy fbtrace_id"
                      >
                        {log.fbtraceId}
                        <Copy className="w-3 h-3 text-cyan-600" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 font-medium">
            Page {page} of {totalPages} ({data?.total} events)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Log Detail Inspector Modal (Clean Light Theme) */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[85vh] animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h4 className="text-base font-extrabold text-slate-900">Webhook Audit Inspector</h4>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
                  Comment ID
                </span>
                <span className="text-emerald-700 font-bold">{selectedLog.commentId || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
                  User
                </span>
                <span className="text-slate-900 font-bold">@{selectedLog.username || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
                  Send Status
                </span>
                <div className="mt-1">{statusBadge(selectedLog.status)}</div>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
                  fbtrace_id
                </span>
                <span className="text-cyan-700 font-bold">{selectedLog.fbtraceId || '—'}</span>
              </div>
            </div>

            {/* Diagnostic Box */}
            {selectedLog.errorMessage && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 block">
                  Error Trace Diagnostic
                </span>
                <p className="text-xs text-rose-900 leading-relaxed font-mono">
                  {selectedLog.errorMessage}
                </p>
                {selectedLog.errorMessage.includes('(#230)') && (
                  <div className="pt-2 border-t border-rose-200 text-[11px] text-amber-900 leading-relaxed font-sans">
                    <strong>Why Meta Error (#230) Happens:</strong> Meta returned a permission error
                    because your connected Access Token lacks <code>pages_messaging</code> or{' '}
                    <code>instagram_manage_messages</code> permission scope. Re-connect your
                    Instagram Account in Settings and ensure all Page permission checkboxes are
                    selected during Meta OAuth login.
                  </div>
                )}
                {selectedLog.errorMessage.includes('(#200)') && (
                  <div className="pt-2 border-t border-rose-200 text-[11px] text-amber-900 leading-relaxed font-sans">
                    <strong>Why Meta Error (#200) Happens:</strong> Your Meta App is in{' '}
                    <strong>Development Mode</strong>. Meta Graph API blocks outgoing DMs to users
                    who are not registered as Developers, Admins, or Testers in your Meta App
                    Dashboard under <em>App Roles</em>.
                  </div>
                )}
              </div>
            )}

            {/* Raw Payload JSON */}
            {selectedLog.payload && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Raw Webhook Payload
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(JSON.stringify(selectedLog.payload, null, 2), 'Raw payload')
                    }
                    className="text-[11px] text-emerald-700 flex items-center gap-1 font-mono hover:underline font-semibold"
                  >
                    <Copy className="w-3 h-3" /> Copy JSON
                  </button>
                </div>
                <pre className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] text-slate-800 font-mono overflow-x-auto max-h-48 scrollbar-thin">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
