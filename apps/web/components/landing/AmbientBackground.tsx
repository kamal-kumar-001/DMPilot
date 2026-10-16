'use client';

import * as React from 'react';

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Warm luminous ivory base with multi-radial corner gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(243,156,18,0.14),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(65,182,230,0.12),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(0,187,136,0.10),transparent_35%),linear-gradient(135deg,rgba(255,247,240,0.7),rgba(255,255,255,0.95))]" />

      {/* Clean high-definition precision grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}
