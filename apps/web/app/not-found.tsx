'use client';

import * as React from 'react';
import Link from 'next/link';
import { Home, ArrowLeft, Zap } from 'lucide-react';

export default function NotFound() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen text-slate-900 flex flex-col items-center justify-center relative overflow-hidden font-sans select-none">
      <div className="text-center z-10 p-8 max-w-xl space-y-8 animate-fade-in">
        {/* Brand Logo Header */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">DMPilot</span>
        </div>

        {/* 404 Large Gradient Text */}
        <h1 className="text-[120px] sm:text-[160px] font-black tracking-tighter leading-none bg-gradient-to-r from-primary via-emerald-600 to-accent-cyan bg-clip-text text-transparent select-none">
          404
        </h1>

        {/* Description Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl px-6 py-8 max-w-md mx-auto shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Page not found</h2>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Head back to the dashboard
            to continue automating your Instagram DMs.
          </p>
        </div>

        {/* Action Button Links */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
