'use client';

import * as React from 'react';
import Link from 'next/link';
import { Home, ArrowLeft, Zap } from 'lucide-react';

export default function NotFound() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#07090f] flex flex-col items-center justify-center relative overflow-hidden font-sans select-none">
      {/* Premium Ambient Radial Background Glows */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,187,136,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(0,187,136,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="text-center z-10 p-8 max-w-xl space-y-8 animate-fade-in">
        {/* Brand Logo Header */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center shadow-[0_0_20px_rgba(0,187,136,0.35)]">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">DMPilot</span>
        </div>

        {/* 404 Large Gradient Text */}
        <h1 className="text-[120px] sm:text-[160px] font-black tracking-tighter leading-none bg-gradient-to-r from-primary via-accent-cyan to-primary/40 bg-clip-text text-transparent select-none">
          404
        </h1>

        {/* Glassmorphic Description Card */}
        <div className="glass-card border border-white/10 rounded-2xl px-6 py-8 backdrop-blur-xl max-w-md mx-auto shadow-2xl space-y-3">
          <h2 className="text-xl font-bold text-white tracking-tight">Page not found</h2>
          <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Head back to the dashboard
            to continue automating your Instagram DMs.
          </p>
        </div>

        {/* Action Button Links */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-[0_0_20px_rgba(0,187,136,0.25)] hover:shadow-[0_0_25px_rgba(0,187,136,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 font-semibold text-sm transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
