'use client';

import * as React from 'react';

/**
 * Thin scroll-progress bar pinned to the top of the landing page.
 * Transform-only (scaleX), rAF-throttled, purely additive: nothing depends
 * on it and it renders nothing until hydrated.
 */
export default function ScrollProgress() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-0.5 z-50 origin-left bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
      style={{ transform: 'scaleX(0)' }}
    />
  );
}
