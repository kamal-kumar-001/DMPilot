'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

/**
 * Progressive-enhancement entrance animation.
 *
 * The server-rendered / no-JS output is a plain, fully visible element.
 * Framer-motion (with its hidden initial state) is only mounted after
 * hydration, so a JS or animation failure can never erase landing content -
 * the entrance motion is purely an enhancement layered on top.
 */
export default function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.6,
  y = 20,
  inView = false,
  float = 0,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  y?: number;
  inView?: boolean;
  float?: number;
  onClick?: () => void;
}) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  if (!hydrated) {
    return (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    );
  }

  const transition: any = float
    ? {
        opacity: { duration: 0.6, delay, ease: 'easeOut' },
        y: { repeat: Infinity, duration: 5 + float / 5, ease: 'easeInOut', delay },
      }
    : { duration, delay };

  if (inView) {
    return (
      <motion.div
        className={className}
        onClick={onClick}
        initial={{ opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={transition}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: float ? [0, -float, 0] : 0 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
