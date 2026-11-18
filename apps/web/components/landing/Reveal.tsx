'use client';

import * as React from 'react';

/**
 * Resilient scroll reveal. SSR and the initial client render are ALWAYS
 * fully visible: the hidden state is applied only after hydration, only when
 * IntersectionObserver exists and reduced-motion is off, and a safety timer
 * force-reveals even if the observer never fires. Content can never be
 * blanked by this component (the failure mode that removed FadeIn reveals).
 */
export default function Reveal({
  children,
  className,
  y = 18,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setHidden(true);
    const reveal = () => setHidden(false);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    const safety = window.setTimeout(reveal, 1500);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? `translateY(${y}px)` : 'none',
        transition: 'opacity 500ms ease-out, transform 500ms ease-out',
        willChange: hidden ? 'opacity, transform' : undefined,
      }}
    >
      {children}
    </div>
  );
}
