'use client';

import * as React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
  createdAt: string;
  user: { email: string; name: string | null };
  instagramAccount: { username: string };
  _count: { keywords: number; posts: number };
}

const statusColors: Record<string, string> = {
  ACTIVE: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  PAUSED: 'text-amber-800 bg-amber-50 border-amber-200',
  ARCHIVED: 'text-slate-600 bg-slate-100 border-slate-200',
};

export function AdminCampaigns() {
  const [data, setData] = React.useState<{ data: Campaign[]; total: number } | null>(null);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({
      page: String(page),
      limit: '20',
      ...(search ? { search } : {}),
    });
    apiRequest<{ data: Campaign[]; total: number }>(`/admin/campaigns?${q}`)
      .then((r) => setData(r && Array.isArray(r.data) ? r : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, search]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search campaigns or creator…"
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary shadow-xs"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-100 transition-colors shadow-xs cursor-pointer"
        >
          Search
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <span className="text-xs text-slate-500 font-medium">{total} campaigns</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100 bg-slate-50/70">
                {[
                  'Campaign',
                  'Creator',
                  'Account',
                  'Status',
                  'Type',
                  'Keywords',
                  'Posts',
                  'Created',
                ].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 rounded bg-slate-100 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    No campaigns found.
                  </td>
                </tr>
              ) : (
                data.data.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-[140px] truncate">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.user.email}</td>
                    <td className="px-4 py-3 text-slate-600">@{c.instagramAccount.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusColors[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-slate-600 text-center">{c._count.keywords}</td>
                    <td className="px-4 py-3 text-slate-600 text-center">{c._count.posts}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-slate-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
