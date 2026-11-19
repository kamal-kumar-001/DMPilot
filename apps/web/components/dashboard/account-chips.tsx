'use client';

import * as React from 'react';
import { cn } from '@dmpilot/ui';
import { Users } from 'lucide-react';
import { useAccountFilter } from '@/lib/account-filter';

function AccountPhoto({ src, username }: { src?: string | null; username: string }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-800"
    >
      {username.slice(0, 2).toUpperCase()}
    </span>
  );
}

/**
 * Account picker chips. "All accounts" is selected by default; each connected
 * account gets its own chip. Selection is shared via AccountFilterProvider.
 */
export function AccountChips({ className }: { className?: string }) {
  const { accounts, loading, selectedAccountId, setSelectedAccountId } = useAccountFilter();

  if (!loading && accounts.length === 0) return null;

  const chipClass = (active: boolean) =>
    cn(
      'inline-flex min-h-12 max-w-full shrink-0 items-center gap-2 px-3 py-2 rounded-full text-sm font-bold border transition-all cursor-pointer',
      active
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70 shadow-sm'
        : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50',
    );

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Filter by Instagram account"
    >
      <button
        type="button"
        className={chipClass(selectedAccountId === null)}
        aria-pressed={selectedAccountId === null}
        onClick={() => setSelectedAccountId(null)}
      >
        <Users aria-hidden="true" className="h-5 w-5" />
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
          <AccountPhoto src={account.profilePicture} username={account.username} />
          <span className="max-w-[160px] truncate">@{account.username}</span>
        </button>
      ))}
    </div>
  );
}
