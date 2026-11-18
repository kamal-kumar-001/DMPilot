'use client';

import * as React from 'react';
import { cn } from '@dmpilot/ui';

export const PERIOD_OPTIONS = [7, 30] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodDays;
  onChange: (days: PeriodDays) => void;
}) {
  return (
    <div
      className="flex items-center rounded-full border border-slate-200 bg-white p-0.5"
      role="group"
      aria-label="Stats period"
    >
      {PERIOD_OPTIONS.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          onClick={() => onChange(days)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer',
            value === days
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
              : 'text-slate-500 hover:text-slate-900 border border-transparent',
          )}
        >
          {days}d
        </button>
      ))}
    </div>
  );
}
