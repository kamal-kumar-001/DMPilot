'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast rounded-xl p-4 font-medium border shadow-xl transition-all !text-white group-[.toaster]:!bg-gradient-to-r group-[.toaster]:!from-emerald-600/80 group-[.toaster]:!via-teal-600/80 group-[.toaster]:!to-cyan-600/80 group-[.toaster]:!border-emerald-400/30 group-[.toaster]:!text-white backdrop-blur-md',
          description: 'group-[.toast]:!text-white/90 text-xs mt-1 font-normal',
          actionButton:
            'group-[.toast]:bg-white group-[.toast]:text-slate-900 font-semibold px-3 py-1.5 rounded-lg shadow-sm',
          cancelButton:
            'group-[.toast]:bg-black/20 group-[.toast]:text-white px-3 py-1.5 rounded-lg',
          success:
            'group-[.toaster]:!bg-gradient-to-r group-[.toaster]:!from-emerald-600/85 group-[.toaster]:!via-teal-600/85 group-[.toaster]:!to-cyan-600/85 group-[.toaster]:!border-emerald-400/40 group-[.toaster]:!text-white shadow-lg shadow-emerald-950/20 font-medium backdrop-blur-md',
          error:
            'group-[.toaster]:!bg-rose-600/80 group-[.toaster]:!border-rose-400/40 group-[.toaster]:!text-white shadow-lg shadow-rose-950/20 font-medium backdrop-blur-md',
          warning:
            'group-[.toaster]:!bg-amber-600/80 group-[.toaster]:!border-amber-400/40 group-[.toaster]:!text-white shadow-lg shadow-amber-950/20 font-medium backdrop-blur-md',
          info: 'group-[.toaster]:!bg-cyan-600/80 group-[.toaster]:!border-cyan-400/40 group-[.toaster]:!text-white shadow-lg shadow-cyan-950/20 font-medium backdrop-blur-md',
        },
      }}
    />
  );
}
