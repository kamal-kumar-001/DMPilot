'use client';

import * as React from 'react';

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Fresh teal, neon emerald, and cyan radial corner gradients (no orange) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,187,136,0.15),transparent_36%),radial-gradient(circle_at_85%_20%,rgba(6,182,212,0.14),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.12),transparent_35%),linear-gradient(135deg,rgba(240,253,250,0.7),rgba(255,255,255,0.98))]" />

      {/* Clean high-definition precision grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}
