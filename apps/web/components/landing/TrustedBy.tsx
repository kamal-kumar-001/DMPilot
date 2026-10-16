'use client';

import * as React from 'react';
import { Zap } from 'lucide-react';
import { TRUSTED_LOGOS } from '@/lib/landing-data';

export default function TrustedBy() {
  const doubledLogos = [...TRUSTED_LOGOS, ...TRUSTED_LOGOS];

  return (
    <section className="py-12 border-y border-slate-200/80 overflow-hidden bg-white/70 backdrop-blur-sm relative">
      <div className="max-w-7xl mx-auto px-6 mb-8 text-center">
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-slate-500">
          POWERING ENGAGEMENT FOR FAST-GROWING CREATORS
        </p>
      </div>

      {/* Marquee Continuous Slider */}
      <div className="relative w-full flex overflow-x-hidden">
        <div className="animate-marquee whitespace-nowrap flex py-2">
          {doubledLogos.map((logo, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-2.5 mx-10 text-slate-600 hover:text-slate-900 transition-colors cursor-default"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="text-base font-extrabold tracking-tight text-slate-800">{logo}</span>
            </div>
          ))}
        </div>

        {/* CSS Keyframe Animation Injection */}
        <style jsx global>{`
          @keyframes marquee {
            0% {
              transform: translateX(0%);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          .animate-marquee {
            animation: marquee 25s linear infinite;
            display: flex;
            width: max-content;
          }
        `}</style>
      </div>
    </section>
  );
}
