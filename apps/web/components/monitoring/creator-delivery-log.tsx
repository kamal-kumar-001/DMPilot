'use client';

import * as React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  MessageSquare,
  Sparkles,
  Info,
  Layers,
  Send,
  HelpCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

// Server classifies from real evidence only: ACCEPTED needs a real provider
// message id, QUEUED is an unresolved manual_ placeholder, SANDBOX recorded
// without a provider call, UNKNOWN means matched but no outcome recorded.
type DeliveryStatus = 'ACCEPTED' | 'QUEUED' | 'SANDBOX' | 'FAILED' | 'NO_MATCH' | 'UNKNOWN';

interface DeliveryLogItem {
  id: string;
  commentId: string;
  commenterUsername: string;
  commentText: string;
  mediaId: string;
  status: DeliveryStatus;
  dispatchStatus: string;
  campaignName: string;
  matchedKeyword: string;
  deliveredDmText: string;
  fbtraceId?: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  ACCEPTED: 'Accepted',
  QUEUED: 'Sending',
  SANDBOX: 'Sandbox',
  FAILED: 'Failed',
  NO_MATCH: 'No match',
  UNKNOWN: 'Unknown',
};

export function CreatorDeliveryLog() {
  const [loading, setLoading] = React.useState(true);
  const [logs, setLogs] = React.useState<DeliveryLogItem[]>([]);
  const [filter, setFilter] = React.useState<'ALL' | DeliveryStatus>('ALL');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth<{ logs: DeliveryLogItem[] }>(
        '/monitoring/delivery-logs?limit=50',
      );
      // Real rows only. An empty log renders the honest empty state below -
      // never fabricated demo entries under real-looking handles.
      setLogs(res?.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLogs = logs.filter((log) => (filter === 'ALL' ? true : log.status === filter));

  // Acceptance = real provider acceptance only. Queued and sandbox rows are
  // unresolved / not provider-verified, so they never join the rate.
  const acceptedCount = logs.filter((l) => l.status === 'ACCEPTED').length;
  const resolvedAttempts = logs.filter(
    (l) => l.status === 'ACCEPTED' || l.status === 'FAILED',
  ).length;
  // No resolved attempts yet means no rate, not a fake perfect score.
  const acceptanceRate =
    resolvedAttempts > 0 ? `${((acceptedCount / resolvedAttempts) * 100).toFixed(1)}%` : '—';

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
              COMMERCE ENGINE
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Delivery Logs</h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Comment matching and DM send outcomes. Accepted means Instagram accepted the DM; it does
            not prove the person saw it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            DMs ACCEPTED BY INSTAGRAM
          </span>
          <div className="text-2xl font-black text-slate-900">{acceptedCount}</div>
          <p className="text-[10px] text-slate-500 font-mono">
            out of {resolvedAttempts} resolved send attempts
          </p>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            ACCEPTANCE RATE
          </span>
          <div className="text-2xl font-black text-emerald-600">{acceptanceRate}</div>
          <p className="text-[10px] text-emerald-700 font-mono">
            {resolvedAttempts > 0
              ? 'excludes unmatched, queued and sandbox'
              : 'no resolved send attempts yet'}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            TOTAL COMMENTS PROCESSED
          </span>
          <div className="text-2xl font-black text-slate-900">{logs.length}</div>
          <p className="text-[10px] text-slate-500 font-mono">
            includes general & non-keyword comments
          </p>
        </div>
      </div>

      {/* Status Filter Bar */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit max-w-full overflow-x-auto">
        {(['ALL', 'ACCEPTED', 'QUEUED', 'FAILED', 'NO_MATCH'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filter === f
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {f === 'ALL' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Delivery Log Rows */}
      {loading && logs.length === 0 ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <Info className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-semibold">
            {filter === 'ALL'
              ? 'No delivery events yet. They appear here after your automations process comments.'
              : `No delivery events found for filter “${STATUS_LABEL[filter]}”.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2 custom-scrollbar max-h-[500px] overflow-y-auto pr-1">
          {filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            const isAccepted = log.status === 'ACCEPTED';
            const isFailed = log.status === 'FAILED';
            const isQueued = log.status === 'QUEUED';

            return (
              <div
                key={log.id}
                className="bg-white border border-slate-200/90 rounded-xl transition-all overflow-hidden shadow-xs hover:border-slate-300"
              >
                {/* Row Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="flex items-center justify-between p-3.5 cursor-pointer text-xs font-sans select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-slate-500 text-[11px] font-mono flex-shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 ${
                        isAccepted
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : isFailed
                            ? 'text-rose-700 bg-rose-50 border border-rose-200'
                            : isQueued
                              ? 'text-amber-700 bg-amber-50 border border-amber-200'
                              : 'text-slate-600 bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {STATUS_LABEL[log.status] ?? log.status}
                    </span>

                    <span className="text-slate-900 font-medium truncate text-xs">
                      <strong className="text-pink-600 font-bold">{log.commenterUsername}</strong>{' '}
                      <span className="text-slate-600 font-normal">{log.dispatchStatus}</span>
                    </span>
                  </div>

                  <div className="text-slate-400 hover:text-slate-700 transition-colors">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Accordion Details */}
                {isExpanded && (
                  <div className="p-4 bg-white border-t border-slate-100 space-y-2.5 text-xs text-slate-700 font-sans animate-in fade-in duration-200">
                    <div className="flex gap-2">
                      <span className="text-pink-600 font-bold uppercase text-[10px] w-36 flex-shrink-0">
                        {log.commentText?.includes('Shared Post') ||
                        log.commentText?.includes('Shared a post')
                          ? 'POST SHARED TO DM'
                          : 'COMMENT RECEIVED'}
                      </span>
                      <span className="text-slate-900 font-semibold break-words">
                        &quot;{log.commentText}&quot;
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <span className="text-pink-600 font-bold uppercase text-[10px] w-36 flex-shrink-0">
                        MATCHED CAMPAIGN
                      </span>
                      <span className="text-amber-700 font-semibold">
                        {log.campaignName} (Trigger: &quot;{log.matchedKeyword}&quot;)
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <span className="text-pink-600 font-bold uppercase text-[10px] w-36 flex-shrink-0">
                        {log.status === 'ACCEPTED'
                          ? 'DM ACCEPTED'
                          : log.status === 'QUEUED'
                            ? 'DM QUEUED'
                            : log.status === 'SANDBOX'
                              ? 'DM RECORDED (SANDBOX)'
                              : log.status === 'FAILED'
                                ? 'DM FAILED'
                                : 'DM TEXT'}
                      </span>
                      <span
                        className={`font-semibold break-words ${
                          log.status === 'ACCEPTED' ? 'text-emerald-700' : 'text-slate-700'
                        }`}
                      >
                        {log.deliveredDmText}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>
                        {log.commentText?.includes('Shared Post') ||
                        log.commentText?.includes('Shared a post')
                          ? 'Event / Message ID'
                          : 'Comment ID'}
                        : {log.commentId}
                      </span>
                      {log.fbtraceId && <span>fbtrace_id: {log.fbtraceId}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
