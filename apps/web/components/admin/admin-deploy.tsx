'use client';
import { Rocket, RotateCcw } from 'lucide-react';

/** Staged visual release. No deploy mutations until the runner safety review passes. */
export function AdminDeploy() {
  return (
    <section className="rounded-2xl bg-white/85 border border-slate-200/80 p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Backend update</h2>
        <p className="mt-1 text-xs text-slate-500">
          Safety testing in progress. Update and rollback are disabled until the host runner is
          verified.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white opacity-40 cursor-not-allowed"
        >
          <Rocket className="h-3.5 w-3.5" />
          Update to latest
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-400 cursor-not-allowed"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Rollback
        </button>
      </div>
      <details>
        <summary className="text-xs font-bold text-slate-500 cursor-pointer">
          Advanced: update a specific commit ID
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          Also disabled while safety testing is in progress.
        </p>
      </details>
      <p className="text-[11px] text-slate-500">
        Frontend updates still use Vercel. Backend records are retained for safety.
      </p>
    </section>
  );
}
