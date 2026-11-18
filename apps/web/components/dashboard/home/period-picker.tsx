'use client';

import * as React from 'react';
import { cn } from '@dmpilot/ui';

export const PERIOD_OPTIONS = [7, 30] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];

export function PeriodPicker({
  value,
  onChange,
  disabled = false,
  disabledReason,
}: {
  value: PeriodDays;
  onChange: (days: PeriodDays) => void;
  /** Renders the picker inert with an entitlement explanation (free plans). */
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div
      className="flex items-center rounded-full border border-slate-200 bg-white p-0.5"
      role="group"
      aria-label="Stats period"
      title={disabled ? disabledReason : undefined}
    >
      {PERIOD_OPTIONS.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          disabled={disabled}
          onClick={() => onChange(days)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-bold transition-all',
            disabled
              ? 'text-slate-300 cursor-not-allowed'
              : value === days
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70 cursor-pointer'
                : 'text-slate-500 hover:text-slate-900 border border-transparent cursor-pointer',
          )}
        >
          {days}d
        </button>
      ))}
      {disabled && disabledReason && (
        <span className="px-2 text-[10px] font-semibold text-slate-400 whitespace-nowrap">
          {disabledReason}
        </span>
      )}
    </div>
  );
}
