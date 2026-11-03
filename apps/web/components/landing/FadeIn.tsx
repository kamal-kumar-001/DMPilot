import * as React from 'react';

/**
 * Landing section wrapper. Renders plain, always-visible markup: no hidden
 * initial state, no JS-gated reveal. Entrance/reveal animations were removed
 * after they repeatedly hid content when scripts or animation timing failed;
 * the optional `float` effect is a pure-CSS transform animation (no opacity),
 * so content can never be blanked by it.
 */
export default function FadeIn({
  children,
  className,
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
  const floatClass = float ? (float > 9 ? ' dm-float-slow' : ' dm-float') : '';
  return (
    <div className={`${className || ''}${floatClass}`} onClick={onClick}>
      {children}
    </div>
  );
}
