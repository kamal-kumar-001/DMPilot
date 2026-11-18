'use client';

import * as React from 'react';

/**
 * SkyPatrol: playful landing-page sky layer with original inline-SVG artwork.
 *
 * Small cartoon planes with continuously spinning propellers wander freely
 * around the whole hero on gentle curving paths (sum-of-sinusoids wobble,
 * never straight lines), trailing soft smoke bubbles and continuously
 * dropping little envelopes that sway down the page and fade out just above
 * the footer, where they are removed. Transform/opacity-only animation,
 * pointer-events off, nothing at all for reduced-motion users.
 */

const ENVELOPE_COLORS = ['#E7C189', '#F2A3B7', '#A9C7E8', '#F3E6C0'];
const MAX_ENVELOPES = 60;
const MAX_SMOKE = 80;

function envelopeSVG(): string {
  const fill = ENVELOPE_COLORS[Math.floor(Math.random() * ENVELOPE_COLORS.length)];
  return `<svg viewBox="0 0 24 18" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><rect x="1.2" y="1.2" width="21.6" height="15.6" rx="2.6" fill="${fill}" stroke="#4A3F35" stroke-width="1.7"/><path d="M2.4 3.4 L12 10.6 L21.6 3.4" fill="none" stroke="#4A3F35" stroke-width="1.7" stroke-linecap="round"/></svg>`;
}

function planeSVG(uid: string): string {
  return `<svg viewBox="0 0 210 150" width="100%" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 6px 8px rgba(15,23,42,0.16))">
  <defs>
    <clipPath id="fuse-${uid}"><rect x="30" y="46" width="132" height="44" rx="22"/></clipPath>
  </defs>
  <circle cx="180" cy="68" r="34" fill="#E2E8F0" opacity="0.35"/>
  <rect x="36" y="4" width="19" height="48" rx="9.5" fill="#0D9488" transform="rotate(-13 45 28)"/>
  <rect x="20" y="72" width="36" height="13" rx="6.5" fill="#0D9488" transform="rotate(10 38 78)"/>
  <rect x="64" y="30" width="46" height="15" rx="7.5" fill="#0F766E" transform="rotate(-20 87 37)"/>
  <rect x="66" y="88" width="66" height="24" rx="12" fill="#14B8A6" transform="rotate(-14 99 100)"/>
  <rect x="30" y="46" width="132" height="44" rx="22" fill="#10B981"/>
  <g clip-path="url(#fuse-${uid})">
    <rect x="30" y="68" width="132" height="22" fill="#0D9488" opacity="0.5"/>
  </g>
  <path d="M92,47 C92,30 106,20 120,23 C134,26 138,36 138,47 Z" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="2"/>
  <ellipse cx="110" cy="31" rx="8" ry="4" fill="#FFFFFF" opacity="0.85" transform="rotate(-18 110 31)"/>
  <ellipse cx="166" cy="68" rx="13" ry="20" fill="#F59E0B"/>
  <circle cx="146" cy="58" r="7" fill="#FFFFFF"/>
  <circle cx="148.5" cy="58" r="3.2" fill="#1E293B"/>
  <path d="M138,72 Q146,79 155,72" stroke="#065F46" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <g class="dm-prop">
    <rect x="176" y="36" width="8" height="64" rx="4" fill="#475569"/>
    <circle cx="180" cy="68" r="6" fill="#334155"/>
    <circle cx="180" cy="68" r="2" fill="#94A3B8"/>
  </g>
</svg>`;
}

type FlightParams = {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
};

/** Per-plane wobble parameters: incommensurate frequencies make the path
 *  wander through the whole hero without repeating or straightening out. */
const FLIGHTS: FlightParams[] = [
  { w1: 0.131, w2: 0.047, w3: 0.169, w4: 0.071, p1: 0.0, p2: 1.7, p3: 3.9, p4: 0.8 },
  { w1: 0.107, w2: 0.065, w3: 0.145, w4: 0.044, p1: 2.6, p2: 5.1, p3: 1.2, p4: 4.4 },
];

export default function SkyPatrol() {
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const planeLayerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const overlay = overlayRef.current;
    const planeLayer = planeLayerRef.current;
    if (!overlay || !planeLayer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const hero = document.getElementById('dm-hero');
    if (!hero) return;
    const footer = document.querySelector('footer');

    const vw = window.innerWidth;
    const isPhone = vw < 1024;
    const planeW = isPhone ? 68 : 88;
    const planeH = Math.round((planeW * 150) / 210);
    // On phones the hero content fills nearly the whole width, so a plane
    // behind it is barely visible; fly the plane layer above the content
    // there (Kamal OK'd planes crossing the text). Envelopes stay behind
    // content on every screen size. Desktop is unchanged.
    if (isPhone) planeLayer.style.zIndex = '20';

    let heroTop = 0;
    let heroBottom = 0;
    let footerTop = 0;
    const measure = () => {
      const rect = hero.getBoundingClientRect();
      heroTop = rect.top + window.scrollY;
      heroBottom = heroTop + rect.height;
      footerTop = footer
        ? footer.getBoundingClientRect().top + window.scrollY
        : document.body.scrollHeight;
    };
    measure();
    window.addEventListener('resize', measure);
    const remeasureTimer = window.setTimeout(measure, 1500);

    type Plane = {
      outer: HTMLDivElement;
      flipper: HTMLDivElement;
      tilter: HTMLDivElement;
      params: FlightParams;
      dir: 1 | -1;
      nextDrop: number;
      nextPuff: number;
      x: number;
      y: number;
    };

    const planeCount = isPhone ? 1 : FLIGHTS.length;
    const planes: Plane[] = [];
    for (let i = 0; i < planeCount; i++) {
      const outer = document.createElement('div');
      outer.style.cssText = `position:absolute;left:0;top:0;width:${planeW}px;will-change:transform;pointer-events:none;`;
      // Instant mirror flip (no transition, so the plane never squashes
      // through zero width) with a smooth tilt layer inside it.
      const flipper = document.createElement('div');
      flipper.style.cssText = 'will-change:transform;';
      const tilter = document.createElement('div');
      tilter.style.cssText = 'transition:transform 0.35s ease;will-change:transform;';
      tilter.innerHTML = planeSVG(`plane${i}`);
      flipper.appendChild(tilter);
      outer.appendChild(flipper);
      planeLayer.appendChild(outer);
      planes.push({
        outer,
        flipper,
        tilter,
        params: FLIGHTS[i],
        dir: 1,
        nextDrop: performance.now() + 900 + i * 1100,
        nextPuff: 0,
        x: 0,
        y: 0,
      });
    }

    const envelopes = new Set<HTMLDivElement>();
    const puffs = new Set<HTMLDivElement>();

    const spawnEnvelope = (x: number, y: number) => {
      if (envelopes.size >= MAX_ENVELOPES) return;
      const dist = footerTop - y - 70;
      if (dist < 260) return;
      const size = 13 + Math.random() * 6;
      const outer = document.createElement('div');
      outer.style.cssText = `position:absolute;left:${x - size / 2}px;top:${y}px;width:${size}px;pointer-events:none;will-change:transform;`;
      const inner = document.createElement('div');
      inner.className = 'dm-env-sway';
      inner.style.animationDelay = `${-(Math.random() * 2.8)}s`;
      inner.innerHTML = envelopeSVG();
      outer.appendChild(inner);
      overlay.appendChild(outer);
      // Steady paper-drift fall: a soft ease-in start, then a constant gentle
      // descent all the way down the page. Sway is side-to-side only (CSS).
      const speed = 95 + Math.random() * 40; // px per second
      const anim = outer.animate(
        [
          { transform: 'translate3d(0,0,0)', opacity: 1 },
          { transform: `translate3d(0,${dist * 0.92}px,0)`, opacity: 1, offset: 0.9 },
          { transform: `translate3d(0,${dist}px,0)`, opacity: 0 },
        ],
        { duration: (dist / speed) * 1000, easing: 'cubic-bezier(.25,.08,.3,1)' },
      );
      envelopes.add(outer);
      anim.onfinish = () => {
        if (outer.parentNode === overlay) overlay.removeChild(outer);
        envelopes.delete(outer);
      };
    };

    const spawnPuff = (x: number, y: number, dir: 1 | -1) => {
      if (puffs.size >= MAX_SMOKE) return;
      const size = (isPhone ? 6 : 8) + Math.random() * 5;
      const puff = document.createElement('div');
      puff.style.cssText = `position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-radius:9999px;pointer-events:none;background:radial-gradient(circle at 35% 35%, rgba(226,232,240,0.9), rgba(148,163,184,0.55));will-change:transform,opacity;`;
      planeLayer.appendChild(puff);
      const driftX = -dir * (16 + Math.random() * 14);
      const driftY = -(8 + Math.random() * 10);
      const anim = puff.animate(
        [
          { transform: 'translate3d(0,0,0) scale(0.45)', opacity: 0.65 },
          {
            transform: `translate3d(${driftX * 0.6}px,${driftY * 0.6}px,0) scale(1)`,
            opacity: 0.4,
            offset: 0.55,
          },
          { transform: `translate3d(${driftX}px,${driftY}px,0) scale(1.9)`, opacity: 0 },
        ],
        { duration: 1300 + Math.random() * 450, easing: 'cubic-bezier(.2,.4,.4,1)' },
      );
      puffs.add(puff);
      anim.onfinish = () => {
        if (puff.parentNode === planeLayer) planeLayer.removeChild(puff);
        puffs.delete(puff);
      };
    };

    let raf = 0;
    const tick = (now: number) => {
      const t = now / 1000;
      const w = window.innerWidth;
      // Flight region: the whole hero, with a small margin. Planes may pass
      // over the content there - that is intentional (Kamal's call).
      const x0 = 10;
      const x1 = Math.max(x0 + 40, w - planeW - 10);
      // Phone: start just under the fixed 80px navbar so the plane never
      // flies over it, and run to just above the hero's bottom edge.
      const y0 = heroTop + (isPhone ? 88 : 60);
      const y1 = Math.max(y0 + 40, heroBottom - planeH - (isPhone ? 24 : 48));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const ax = (x1 - x0) / 2;
      const ay = (y1 - y0) / 2;

      for (const p of planes) {
        const f = p.params;
        // Weighted sum of two sine waves per axis: smooth, curvy, never a
        // straight segment; velocity below drives facing and banking.
        const x = cx + ax * (0.62 * Math.sin(f.w1 * t + f.p1) + 0.38 * Math.sin(f.w2 * t + f.p2));
        // Phone vertical motion: one dominant sine (reaches the band edges
        // every half period, ~19s, and dwells there) with a light secondary
        // wobble, so the plane reliably visits the top of the hero instead
        // of hovering mid-band. Desktop keeps the original two-sine wander.
        const y = isPhone
          ? cy + ay * (0.92 * Math.sin(f.w3 * t + f.p3) + 0.08 * Math.sin(f.w4 * t + f.p4))
          : cy + ay * (0.62 * Math.sin(f.w3 * t + f.p3) + 0.38 * Math.sin(f.w4 * t + f.p4));
        const vx =
          ax * (0.62 * f.w1 * Math.cos(f.w1 * t + f.p1) + 0.38 * f.w2 * Math.cos(f.w2 * t + f.p2));
        const vy = isPhone
          ? ay * (0.92 * f.w3 * Math.cos(f.w3 * t + f.p3) + 0.08 * f.w4 * Math.cos(f.w4 * t + f.p4))
          : ay *
            (0.62 * f.w3 * Math.cos(f.w3 * t + f.p3) + 0.38 * f.w4 * Math.cos(f.w4 * t + f.p4));
        p.x = x;
        p.y = y;
        if (vx > 12) p.dir = 1;
        else if (vx < -12) p.dir = -1;
        const tilt = Math.max(-12, Math.min(12, vy * 0.28));
        p.outer.style.transform = `translate3d(${x}px,${y}px,0)`;
        // The artwork faces right (propeller at the right); mirror when flying left.
        p.flipper.style.transform = `scaleX(${p.dir > 0 ? 1 : -1})`;
        p.tilter.style.transform = `rotate(${p.dir > 0 ? tilt : -tilt}deg)`;

        // Smoke bubbles from the tail, a few per second.
        if (now >= p.nextPuff) {
          const tailX = x + (p.dir > 0 ? 4 : planeW - 4);
          spawnPuff(tailX, y + planeH * 0.55, p.dir);
          p.nextPuff = now + 240 + Math.random() * 90;
        }
        // Continuous envelope drops from the bag under the belly; often two
        // at once so several are always falling together.
        if (now >= p.nextDrop) {
          const bellyX = x + planeW / 2 + (Math.random() * 14 - 7);
          const bellyY = y + planeH * 0.82;
          spawnEnvelope(bellyX, bellyY);
          if (Math.random() < 0.35) {
            spawnEnvelope(bellyX + (Math.random() * 18 - 9), bellyY + 6);
          }
          p.nextDrop = now + 1000 + Math.random() * 600;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(remeasureTimer);
      window.removeEventListener('resize', measure);
      for (const p of planes) {
        if (p.outer.parentNode === planeLayer) planeLayer.removeChild(p.outer);
      }
      for (const e of envelopes) {
        if (e.parentNode === overlay) overlay.removeChild(e);
      }
      envelopes.clear();
      for (const s of puffs) {
        if (s.parentNode === planeLayer) planeLayer.removeChild(s);
      }
      puffs.clear();
    };
  }, []);

  return (
    <>
      {/* Envelope layer: always behind page content. */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5] overflow-hidden select-none"
      />
      {/* Plane + smoke layer: behind content on desktop, above it on phones
          (z-index set in the effect) so the plane stays visible. */}
      <div
        ref={planeLayerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5] overflow-hidden select-none"
      />
    </>
  );
}
