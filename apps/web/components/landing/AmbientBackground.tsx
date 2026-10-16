'use client';

import * as React from 'react';

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Clean high-definition grid pattern across whole page */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* Top Hero Gradient Glow */}
      <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[85vw] max-w-[950px] h-[450px] rounded-full bg-gradient-to-b from-primary/16 via-accent-cyan/10 to-transparent blur-[120px]" />

      {/* Mid-page Gradient Glow */}
      <div className="absolute top-[38%] right-[-120px] w-[55vw] max-w-[650px] h-[550px] rounded-full bg-gradient-to-bl from-accent-cyan/12 via-primary/8 to-transparent blur-[140px]" />

      {/* Bottom Section Gradient Glow */}
      <div className="absolute top-[70%] left-[-120px] w-[55vw] max-w-[650px] h-[550px] rounded-full bg-gradient-to-tr from-primary/14 via-emerald-200/20 to-transparent blur-[140px]" />
    </div>
  );
}
