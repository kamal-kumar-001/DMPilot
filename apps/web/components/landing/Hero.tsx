'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Play, Star, Sparkles } from 'lucide-react';
import { HERO_CONTENT } from '@/lib/landing-data';

export default function Hero() {
  const { data: session } = useSession();
  const bars = [45, 70, 55, 90, 65, 80, 95, 60, 75, 88, 50, 72, 85, 60];
  const [activeStep, setActiveStep] = React.useState(0);
  const heroRef = React.useRef<HTMLDivElement>(null);

  // 3D Scroll Perspective Transformation
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const mockupRotateX = useTransform(scrollYProgress, [0, 1], [0, 20]);
  const mockupScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const mockupOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-32 pb-20"
    >
      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Soft warm gradient glow */}
      <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-emerald-100/50 to-teal-100/40 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        {/* Left Column - Main Value Proposition */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="space-y-8"
        >
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-emerald-800">{HERO_CONTENT.badge}</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
            Turn Comments <br />
            Into Customers, <br />
            <span className="bg-gradient-to-r from-primary via-emerald-600 to-accent-cyan bg-clip-text text-transparent">
              {HERO_CONTENT.titleGradient}
            </span>
          </h1>

          {/* Description */}
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-lg">
            {HERO_CONTENT.description}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href={session ? '/dashboard' : '/register'}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-white font-bold text-base shadow-brand hover:shadow-brand-lg transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              {session ? 'Go to Dashboard' : HERO_CONTENT.ctaPrimary}{' '}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-base transition-all shadow-sm hover:border-slate-300"
            >
              <Play className="w-4 h-4 text-primary fill-primary" />
              {HERO_CONTENT.ctaSecondary}
            </a>
          </div>

          {/* Micro Social Proof */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
            <div className="flex -space-x-2">
              {['#059669', '#0d9488', '#0284c7', '#4f46e5'].map((color, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {String.fromCharCode(65 + idx)}
                </div>
              ))}
            </div>
            <div>
              <div className="flex text-amber-400 gap-0.5 text-xs">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Trusted by 500+ Indian creators & brands
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right Column - Crisp Interactive Card Mockup */}
        <motion.div
          style={{
            rotateX: mockupRotateX,
            scale: mockupScale,
            opacity: mockupOpacity,
            perspective: 1000,
          }}
          className="relative"
        >
          {/* Main Visual Container */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl relative overflow-hidden">
            {/* Window Dots */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-100">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  LIVE • Meta Verified
                </span>
              </div>
            </div>

            {/* Simulated Automation Funnel Activity */}
            <div className="py-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Inbound Trigger</span>
                  <span className="text-slate-400 font-mono text-[11px]">Just now</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                    R
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">@rohit_vlogs commented:</p>
                    <p className="text-slate-600 font-mono">"bhai price kya hai link bhejo"</p>
                  </div>
                </div>
              </div>

              {/* Arrow Connection */}
              <div className="flex justify-center">
                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
              </div>

              {/* Bot Action Delivery */}
              <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800">
                    Automated Direct Message (0.4s)
                  </span>
                  <span className="text-emerald-700 font-bold text-[11px]">DELIVERED ✓</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  "Hey Rohit! Here is the special 40% launch discount link:
                  https://dmpilot.org/offer"
                </p>
              </div>
            </div>

            {/* Quick Metrics Ticker */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-center">
              <div>
                <p className="text-xs text-slate-500">Delivered</p>
                <p className="text-lg font-black text-slate-900">24,891</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Speed</p>
                <p className="text-lg font-black bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
                  400ms
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">CTR</p>
                <p className="text-lg font-black text-slate-900">38.4%</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
