'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast rounded-xl p-4 font-medium border shadow-xl transition-all text-white group-[.toaster]:bg-slate-900 group-[.toaster]:border-slate-800 group-[.toaster]:text-white',
          description: 'group-[.toast]:text-white/80 text-xs mt-1',
          actionButton:
            'group-[.toast]:bg-white group-[.toast]:text-slate-900 font-semibold px-3 py-1.5 rounded-lg shadow-sm',
          cancelButton:
            'group-[.toast]:bg-black/30 group-[.toast]:text-white px-3 py-1.5 rounded-lg',
          success:
            'group-[.toaster]:border-emerald-600/80 group-[.toaster]:bg-emerald-800 group-[.toaster]:text-white shadow-lg shadow-emerald-950/30 font-medium',
          error:
            'group-[.toaster]:border-rose-600/80 group-[.toaster]:bg-rose-800 group-[.toaster]:text-white shadow-lg shadow-rose-950/30 font-medium',
          warning:
            'group-[.toaster]:border-amber-600/80 group-[.toaster]:bg-amber-800 group-[.toaster]:text-white shadow-lg shadow-amber-950/30 font-medium',
          info: 'group-[.toaster]:border-cyan-600/80 group-[.toaster]:bg-cyan-800 group-[.toaster]:text-white shadow-lg shadow-cyan-950/30 font-medium',
        },
      }}
    />
  );
}
