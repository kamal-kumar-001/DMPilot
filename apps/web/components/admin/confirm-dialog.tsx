'use client';

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Exact text the admin must type to unlock the action. */
  confirmText: string;
  confirmButtonLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Typed-confirmation dialog for destructive or bulk admin actions.
 * The confirm button stays disabled until the admin types the exact
 * required phrase (a count or an action word), matching the backend
 * typed-confirmation enforcement.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  confirmButtonLabel,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState('');

  React.useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  if (!open) return null;

  const matches = typed.trim() === confirmText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4">
        <div className="flex items-start space-x-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-rose-50 border border-rose-200 flex-shrink-0">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
            <p className="break-words text-xs text-slate-600 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Type <span className="text-rose-600 font-extrabold">{confirmText}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400"
            placeholder={confirmText}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || loading}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1.5 shadow-md shadow-rose-600/20"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmButtonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
