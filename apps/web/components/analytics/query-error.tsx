'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Fail-closed query error state for creator cards: an error never renders as
 * an empty state ("No data yet"), because that lies about the account.
 */
export function QueryErrorState({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="py-8 text-center space-y-3">
      <AlertTriangle className="h-7 w-7 text-amber-500 mx-auto" />
      <p className="text-xs text-slate-500">Could not load {label}.</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}
