'use client';

import * as React from 'react';
import { Search, Loader2, Download, Trash2, Play, Pause } from 'lucide-react';
import { apiRequest, API_BASE_URL } from '@/lib/api-client';
import { toast } from '@autodm/ui';
import { CustomSelect } from '../ui/custom-select';

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string; name: string | null } | null;
}

export function AdminLogs() {
  const [data, setData] = React.useState<{ data: AuditLog[]; total: number } | null>(null);
  const [page, setPage] = React.useState(1);
  const [actionFilter, setActionFilter] = React.useState('');
  const [actionInput, setActionInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  // Advanced Operations State
  const [loggingEnabled, setLoggingEnabled] = React.useState(true);
  const [togglingLog, setTogglingLog] = React.useState(false);
  const [purgeTimeframe, setPurgeTimeframe] = React.useState('30');
  const [purging, setPurging] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  const fetchFlag = React.useCallback(async () => {
    try {
      const flags = await apiRequest<any[]>('/admin/flags');
      const logFlag = flags.find((f) => f.key === 'audit_logging');
      if (logFlag) {
        setLoggingEnabled(logFlag.isEnabled);
      }
    } catch {
      // Default to true if not seeded yet
    }
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({
      page: String(page),
      limit: '30',
      ...(actionFilter ? { action: actionFilter } : {}),
    });
    apiRequest<{ data: AuditLog[]; total: number }>(`/admin/logs?${q}`)
      .then((r) => setData(r && Array.isArray(r.data) ? r : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, actionFilter]);

  React.useEffect(() => {
    load();
    fetchFlag();
  }, [load, fetchFlag]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setActionFilter(actionInput);
    setPage(1);
  };

  const handleToggleLogging = async () => {
    setTogglingLog(true);
    try {
      await apiRequest(`/admin/flags/audit_logging/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !loggingEnabled }),
      });
      setLoggingEnabled(!loggingEnabled);
      toast.success(`Audit logging ${!loggingEnabled ? 'resumed' : 'paused'} successfully.`);
    } catch {
      toast.error('Failed to toggle logging status');
    } finally {
      setTogglingLog(false);
    }
  };

  const handlePurge = async () => {
    let cutoff: Date;
    let label = '';
    if (purgeTimeframe === '30') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      label = 'older than 30 days';
    } else if (purgeTimeframe === '90') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      label = 'older than 90 days';
    } else if (purgeTimeframe === 'all') {
      cutoff = new Date();
      label = 'all time (entire history)';
    } else {
      toast.error('Invalid timeframe selection');
      return;
    }

    const confirm = window.confirm(
      `DANGER: Are you sure you want to permanently purge audit logs ${label}? This cannot be undone.`,
    );
    if (!confirm) return;

    setPurging(true);
    try {
      const q = purgeTimeframe === 'all' ? 'all=true' : `before=${cutoff.toISOString()}`;
      await apiRequest(`/admin/logs/purge?${q}`, { method: 'DELETE' });
      toast.success(`Successfully purged logs ${label}`);
      load();
    } catch {
      toast.error('Failed to purge logs');
    } finally {
      setPurging(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const tokenRes = await fetch('/api/auth/session');
      const session = await tokenRes.json();
      const jwt = (session as { accessToken?: string })?.accessToken;

      const q = new URLSearchParams({
        ...(actionFilter ? { action: actionFilter } : {}),
      });

      const res = await fetch(`${API_BASE_URL}/admin/logs/download?${q}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });

      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Downloaded audit logs CSV');
    } catch {
      toast.error('Failed to export audit logs');
    } finally {
      setDownloading(false);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-6">
      {/* Operations Panel */}
      <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Toggle logging */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleLogging}
            disabled={togglingLog}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              loggingEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {togglingLog ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : loggingEnabled ? (
              <Pause className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <Play className="h-3.5 w-3.5 text-amber-700" />
            )}
            <span>{loggingEnabled ? 'Pause Logging' : 'Resume Logging'}</span>
          </button>
          <span className="text-[11px] text-slate-500 font-medium">
            {loggingEnabled ? 'Currently recording all actions.' : 'Logging is temporarily paused.'}
          </span>
        </div>

        {/* Purge & Download */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Purge timeframe select */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
            <span className="text-[11px] text-slate-600 font-semibold pl-1">Purge:</span>
            <CustomSelect
              value={purgeTimeframe}
              onChange={(val) => setPurgeTimeframe(val)}
              className="w-40"
              options={[
                { value: '30', label: 'Older than 30 days' },
                { value: '90', label: 'Older than 90 days' },
                { value: 'all', label: 'All time' },
              ]}
            />
            <button
              onClick={handlePurge}
              disabled={purging}
              className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-all cursor-pointer disabled:opacity-50"
              title="Purge logs matching timeframe"
            >
              {purging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Download CSV */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleFilter} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="Filter by action (e.g. CAMPAIGN_CREATE)…"
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
        >
          Filter
        </button>
      </form>

      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <span className="text-xs text-slate-600 font-semibold">{total} log entries</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold tracking-wider">
                {['User', 'Action', 'Details', 'IP', 'Time'].map((h) => (
                  <th key={h} className="text-left px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-3 rounded bg-slate-100 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                data.data.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {log.user?.email ?? (
                        <span className="text-slate-400 font-normal">system</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700 font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 truncate max-w-[240px]">
                      {log.details ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">
                      {log.ipAddress ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-30 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-30 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
