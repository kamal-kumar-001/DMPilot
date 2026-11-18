'use client';

import * as React from 'react';

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Fresh teal, neon emerald, and cyan radial corner gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,187,136,0.15),transparent_36%),radial-gradient(circle_at_85%_20%,rgba(6,182,212,0.14),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.12),transparent_35%),linear-gradient(135deg,rgba(240,253,250,0.7),rgba(255,255,255,0.98))]" />

      {/* Clean high-definition precision grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* Ambient Autopilot Glider & Slipstream (pure CSS/GPU, conveys 24/7 autopilot at a glance) */}
      <div
        aria-hidden="true"
        className="absolute top-28 left-0 dm-autopilot-glide pointer-events-none select-none"
      >
        <div className="relative flex items-center">
          {/* Slipstream Trail & Smoke Puffs */}
          <div className="flex items-center space-x-1.5 pr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/40 dm-exhaust-pulse" />
            <span className="w-2 h-2 rounded-full bg-teal-400/50 dm-exhaust-pulse [animation-delay:0.3s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/60 dm-exhaust-pulse [animation-delay:0.6s]" />
            <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-emerald-300/40 to-teal-400/60 rounded-full" />
          </div>

          {/* Glider / Rocket with Mini DM Notification Bubble */}
          <div className="relative flex items-center">
            {/* Minimalist Aerodynamic Paper Plane / Glider SVG */}
            <svg
              className="w-7 h-7 text-emerald-600 drop-shadow-sm transform -rotate-12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" fill="url(#glider-grad)" stroke="#00bb88" />
              <path d="M22 2 11 13" stroke="#00a376" />
              <defs>
                <linearGradient
                  id="glider-grad"
                  x1="2"
                  y1="2"
                  x2="22"
                  y2="22"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#00bb88" stopOpacity="0.25" />
                  <stop offset="1" stopColor="#00e5ff" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>

            {/* Trailing Micro-DM Notification Bubble */}
            <div className="absolute -top-3.5 -right-3 px-1.5 py-0.5 rounded-full bg-white/90 border border-emerald-200/90 shadow-2xs flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[9px] font-mono font-bold text-emerald-700">DM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
