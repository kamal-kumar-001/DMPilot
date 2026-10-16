'use client';

import * as React from 'react';
import { apiRequest } from '@/lib/api-client';
import { toast, Button } from '@autodm/ui';
import { Loader2, Trash2, XCircle, AlertTriangle } from 'lucide-react';

interface DeleteRequest {
  id: string;
  reason: string;
  feedback: string | null;
  status: string;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
  };
}

export function AdminDeleteRequests() {
  const [data, setData] = React.useState<{ data: DeleteRequest[]; total: number } | null>(null);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [processing, setProcessing] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    apiRequest<{ data: DeleteRequest[]; total: number }>(
      `/admin/delete-requests?page=${page}&limit=20`,
    )
      .then((r) => {
        setData(r);
        setSelectedIds([]);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && data) {
      setSelectedIds(data.data.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const confirm = window.confirm(
      `CRITICAL WARNING: Are you sure you want to approve deletion for ${selectedIds.length} user account(s)? This will permanently delete all campaigns, connected profiles, and data for these users. This action CANNOT be undone.`,
    );
    if (!confirm) return;

    setProcessing('approve');
    try {
      await apiRequest(`/admin/delete-requests/approve`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      toast.success(`Successfully deleted selected user accounts.`);
      load();
    } catch {
      toast.error('Failed to approve delete requests.');
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    const confirm = window.confirm(
      `Are you sure you want to reject deletion requests for ${selectedIds.length} users?`,
    );
    if (!confirm) return;

    setProcessing('reject');
    try {
      await apiRequest(`/admin/delete-requests/reject`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      toast.success('Successfully rejected selected delete requests.');
      load();
    } catch {
      toast.error('Failed to reject delete requests.');
    } finally {
      setProcessing(null);
    }
  };

  const [metaIdsInput, setMetaIdsInput] = React.useState('');
  const [metaPurging, setMetaPurging] = React.useState(false);
  const [metaPurgeResult, setMetaPurgeResult] = React.useState<{
    found: number;
    deleted: number;
    notFound: number;
    deletedAccounts: any[];
  } | null>(null);

  const handleMetaBulkPurge = async () => {
    const rawLines = metaIdsInput
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      toast.error('Please enter at least one Meta or Instagram User ID.');
      return;
    }

    const confirm = window.confirm(
      `Confirm Deletion: You are about to search and permanently purge data for ${rawLines.length} Meta User ID(s). Proceed?`,
    );
    if (!confirm) return;

    setMetaPurging(true);
    try {
      const res = await apiRequest<{
        found: number;
        deleted: number;
        notFound: number;
        deletedAccounts: any[];
      }>(`/admin/delete-requests/meta-bulk-purge`, {
        method: 'POST',
        body: JSON.stringify({ ids: rawLines }),
      });

      setMetaPurgeResult(res);
      if (res.deleted > 0) {
        toast.success(`Successfully purged ${res.deleted} account(s) from database.`);
      } else {
        toast.info(`Checked ${rawLines.length} IDs: None found in database.`);
      }
      setMetaIdsInput('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to process Meta bulk deletion.');
    } finally {
      setMetaPurging(false);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Meta User Identifiers Data Deletion Box */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-900">
                Meta / Instagram Data Deletion Purge Tool
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                Platform Terms Compliance
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl">
              Paste user IDs directly from Meta Developer Portal (
              <strong>Advanced Settings → Download User Identifiers</strong> file). Any matching
              Instagram accounts, tokens, and campaigns will be permanently erased.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={metaIdsInput}
            onChange={(e) => setMetaIdsInput(e.target.value)}
            placeholder="Paste Meta User IDs / Instagram Scoped IDs here (separated by newlines, commas, or spaces)&#10;e.g.&#10;1590271825775771&#10;1784140012345678"
            rows={3}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-rose-500 font-mono"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {metaIdsInput.split(/[\n,;\s]+/).filter(Boolean).length} ID(s) ready to check
            </span>
            <Button
              onClick={handleMetaBulkPurge}
              disabled={metaPurging || !metaIdsInput.trim()}
              size="sm"
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-30 h-8"
            >
              {metaPurging ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1.5" />
              )}
              Purge User Data
            </Button>
          </div>
        </div>

        {metaPurgeResult && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center space-x-4">
              <span className="text-slate-600">
                Total Checked:{' '}
                <strong className="text-slate-900">
                  {metaPurgeResult.found + metaPurgeResult.notFound}
                </strong>
              </span>
              <span className="text-slate-600">
                Found in DB: <strong className="text-slate-900">{metaPurgeResult.found}</strong>
              </span>
              <span className="text-emerald-700 font-semibold">
                Successfully Deleted: <strong>{metaPurgeResult.deleted}</strong>
              </span>
              <span className="text-slate-500">
                Not in DB: <strong>{metaPurgeResult.notFound}</strong>
              </span>
            </div>
            {metaPurgeResult.deletedAccounts && metaPurgeResult.deletedAccounts.length > 0 && (
              <div className="text-[11px] text-slate-600 pt-1 font-mono">
                Deleted accounts:{' '}
                {metaPurgeResult.deletedAccounts
                  .map((a: any) => `@${a.username || a.instagramId}`)
                  .join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk operations bar */}
      <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs flex justify-between items-center">
        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span>{selectedIds.length} selected request(s) for creator deletion.</span>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={handleBulkReject}
            disabled={selectedIds.length === 0 || !!processing}
            variant="secondary"
            size="sm"
            className="text-xs h-8 cursor-pointer disabled:opacity-30 border border-slate-200 text-slate-700 bg-slate-100 hover:bg-slate-200"
          >
            {processing === 'reject' ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            ) : (
              <XCircle className="h-3 w-3 mr-1.5" />
            )}
            Reject
          </Button>

          <Button
            onClick={handleBulkApprove}
            disabled={selectedIds.length === 0 || !!processing}
            size="sm"
            className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-30"
          >
            {processing === 'approve' ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            ) : (
              <Trash2 className="h-3 w-3 mr-1.5" />
            )}
            Approve Deletion
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <span className="text-xs text-slate-600 font-semibold">{total} pending requests</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider text-left">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      data !== null &&
                      data.data.length > 0 &&
                      selectedIds.length === data.data.length
                    }
                    onChange={handleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Creator / User</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Feedback Details</th>
                <th className="py-3 px-4">Requested At</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data === null || data.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No pending deletion requests found.
                  </td>
                </tr>
              ) : (
                data.data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">
                          {row.user?.name || 'No Name'}
                        </span>
                        <span className="text-[10px] text-slate-500">{row.user?.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold">
                        {row.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate" title={row.feedback || ''}>
                      {row.feedback || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold uppercase">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-[11px] text-slate-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-[10px] h-7 cursor-pointer border border-slate-200 bg-white"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-[10px] h-7 cursor-pointer border border-slate-200 bg-white"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
