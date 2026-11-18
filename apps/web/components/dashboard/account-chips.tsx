'use client';

import * as React from 'react';
import { cn } from '@dmpilot/ui';
import { useAccountFilter } from '@/lib/account-filter';

/**
 * Account picker chips. "All accounts" is selected by default; each connected
 * account gets its own chip. Selection is shared via AccountFilterProvider.
 */
export function AccountChips({ className }: { className?: string }) {
  const { accounts, loading, selectedAccountId, setSelectedAccountId } = useAccountFilter();

  if (!loading && accounts.length === 0) return null;

  const chipClass = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer whitespace-nowrap',
      active
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70 shadow-sm'
        : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50',
    );

  return (
    <div
      className={cn('flex items-center gap-2 overflow-x-auto pb-1 -mb-1', className)}
      role="group"
      aria-label="Filter by Instagram account"
    >
      <button
        type="button"
        className={chipClass(selectedAccountId === null)}
        aria-pressed={selectedAccountId === null}
        onClick={() => setSelectedAccountId(null)}
      >
        All accounts
      </button>
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          className={chipClass(selectedAccountId === account.id)}
          aria-pressed={selectedAccountId === account.id}
          onClick={() => setSelectedAccountId(account.id)}
        >
          @{account.username}
        </button>
      ))}
    </div>
  );
}
