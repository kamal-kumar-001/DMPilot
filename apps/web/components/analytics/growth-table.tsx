'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import { useAccountFilter } from '@/lib/account-filter';

/**
 * Per-account follower table with a combined row. Follower counts come from
 * the connected accounts and are added together (not unique people). Change
 * is honestly "Not tracked yet" until daily follower snapshots exist.
 */
export function GrowthTable() {
  const { accounts, loading } = useAccountFilter();

  const combined = accounts.reduce((sum, account) => sum + (account.followersCount ?? 0), 0);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Growth per account
        </h2>
      </div>
      {loading ? (
        <div className="p-6 space-y-2">
          <div className="h-4 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          Connect an Instagram account to see growth.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Account</th>
                <th className="px-6 py-3">Followers now</th>
                <th className="px-6 py-3">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-slate-900">@{account.username}</td>
                  <td className="px-6 py-3 text-slate-900 font-semibold">
                    {(account.followersCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-slate-400 font-medium">Not tracked yet</td>
                </tr>
              ))}
              <tr className="bg-slate-50/50">
                <td className="px-6 py-3 font-bold text-slate-900">Combined</td>
                <td className="px-6 py-3 font-bold text-slate-900">{combined.toLocaleString()}</td>
                <td className="px-6 py-3 text-slate-400 font-medium">
                  Counts added together, not unique people
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
