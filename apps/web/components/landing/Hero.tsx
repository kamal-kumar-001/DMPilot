'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import FadeIn from './FadeIn';
import {
  ArrowRight,
  ArrowDown,
  Play,
  Zap,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Send,
  Megaphone,
  Bot,
} from 'lucide-react';

export default function Hero() {
  const { data: session, status } = useSession();

  return (
    <section id="dm-hero" className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      {/* Small original clouds - white/grey gradient with line detail, drifting around the hero (behind content) */}
      <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none select-none">
        <svg viewBox="0 0 120 72" className="dm-cloud absolute top-20 left-[4%] w-20 opacity-90">
          <defs>
            <linearGradient id="dmcg-c1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c1)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-44 right-[5%] w-16 opacity-80 [animation-delay:4s] -scale-x-100"
        >
          <defs>
            <linearGradient id="dmcg-c2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c2)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[58%] left-[7%] w-14 opacity-75 [animation-delay:8s]"
        >
          <defs>
            <linearGradient id="dmcg-c3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c3)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[66%] right-[8%] w-20 opacity-70 [animation-delay:12s] -scale-x-100"
        >
          <defs>
            <linearGradient id="dmcg-c4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c4)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[36%] right-[18%] w-11 opacity-60 [animation-delay:16s]"
        >
          <defs>
            <linearGradient id="dmcg-c5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c5)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[8%] right-[24%] w-14 opacity-70 [animation-delay:6s] hidden sm:block"
        >
          <defs>
            <linearGradient id="dmcg-c6" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c6)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[44%] left-[16%] w-12 opacity-60 [animation-delay:10s] -scale-x-100 hidden sm:block"
        >
          <defs>
            <linearGradient id="dmcg-c7" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c7)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[80%] left-[24%] w-16 opacity-60 [animation-delay:14s] hidden sm:block"
        >
          <defs>
            <linearGradient id="dmcg-c8" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c8)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[24%] left-[38%] w-10 opacity-50 [animation-delay:18s] -scale-x-100 hidden lg:block"
        >
          <defs>
            <linearGradient id="dmcg-c9" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c9)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[14%] left-[24%] w-12 opacity-60 [animation-delay:2s] -scale-x-100 hidden sm:block"
        >
          <defs>
            <linearGradient id="dmcg-c10" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c10)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[52%] right-[26%] w-10 opacity-50 [animation-delay:9s] hidden lg:block"
        >
          <defs>
            <linearGradient id="dmcg-c11" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c11)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[74%] right-[30%] w-14 opacity-60 [animation-delay:5s] -scale-x-100 hidden lg:block"
        >
          <defs>
            <linearGradient id="dmcg-c12" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c12)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[86%] left-[6%] w-11 opacity-50 [animation-delay:11s] hidden lg:block"
        >
          <defs>
            <linearGradient id="dmcg-c13" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c13)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg
          viewBox="0 0 120 72"
          className="dm-cloud absolute top-[6%] left-[52%] w-9 opacity-45 [animation-delay:15s] hidden lg:block"
        >
          <defs>
            <linearGradient id="dmcg-c14" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D3DBE6" />
            </linearGradient>
          </defs>
          <path
            d="M30,58 C18,58 12,48 16,39 C20,30 30,28 36,31 C40,20 52,14 62,18 C72,14 84,20 86,30 C96,28 106,36 105,46 C104,54 96,58 88,58 Z"
            fill="url(#dmcg-c14)"
            stroke="#C2CCDA"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34,45 q8,-7 16,-2"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M58,35 q8,-7 15,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M70,50 q7,-6 14,-1"
            fill="none"
            stroke="#AEB9C8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-16">
        {/* Top Center Value Proposition (Zorcha style) */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Eyebrow Pill */}
          <FadeIn
            y={15}
            duration={0.5}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/90 shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-800 tracking-wide uppercase">
              ✦ Instagram DM Automation Engine
            </span>
          </FadeIn>

          {/* High-Impact Headline */}
          <FadeIn delay={0.1}>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
              Your Instagram comments <br className="hidden sm:inline" />
              have{' '}
              <span className="italic text-emerald-600 [font-family:Georgia,'Times_New_Roman',serif]">
                somewhere
              </span>{' '}
              to go.
            </h1>
          </FadeIn>

          {/* Subtitle / Description */}
          <FadeIn delay={0.2}>
            <p className="text-slate-600 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto font-normal">
              They ask for the link. You’re already on it. Deliver links, discount codes, guides,
              and lead magnets directly into their DMs.
            </p>
          </FadeIn>

          {/* Action CTAs */}
          <FadeIn delay={0.3} className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              aria-busy={status === 'loading'}
              onClick={(event) => {
                if (status === 'loading') event.preventDefault();
              }}
              href={session ? '/dashboard' : '/register'}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-bold text-base shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <span>
                {status === 'loading'
                  ? 'Checking sign-in...'
                  : session
                    ? 'Go to Dashboard'
                    : 'Start Free Today'}
              </span>
              <ArrowRight className="w-4 h-4 text-white" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-base transition-all shadow-xs hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span>See How It Works</span>
            </a>
          </FadeIn>
        </div>

        {/* Three-step automation flow: comment → keyword match → DM inbox. All three
            blocks float via the existing pure-CSS dm-float animations (same effect
            as the previous hero cards). */}
        <div className="max-w-5xl mx-auto relative pt-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-5">
            {/* Step 1: Customer comments */}
            <FadeIn float={8} className="w-full max-w-sm md:w-72">
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-slate-200/90 shadow-xl md:-rotate-2 space-y-3 [backface-visibility:hidden]">
                <p className="text-[11px] font-bold tracking-[0.1em] text-emerald-700">
                  1 · CUSTOMER COMMENTS
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 flex-shrink-0" />
                  <p className="text-sm text-slate-900 leading-snug">
                    <span className="font-bold">priya.creates</span>
                    <br />
                    link please!!
                  </p>
                </div>
              </div>
            </FadeIn>

            <ArrowRight className="hidden md:block w-5 h-5 text-emerald-600 flex-shrink-0" />
            <ArrowDown className="md:hidden w-5 h-5 text-emerald-600 flex-shrink-0" />

            {/* Step 2: DMPilot matches the keyword */}
            <FadeIn float={10} className="w-full max-w-sm md:w-72 [animation-delay:0.6s]">
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-slate-200/90 shadow-xl md:rotate-1 space-y-3 [backface-visibility:hidden]">
                <p className="text-[11px] font-bold tracking-[0.1em] text-emerald-700">
                  2 · DMPILOT MATCHES KEYWORD
                </p>
                <p className="text-sm text-slate-900 leading-relaxed">
                  keyword{' '}
                  <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-md">
                    &quot;link&quot;
                  </span>{' '}
                  on any reel
                  <br />→ DM template <span className="font-bold">#3</span> · follow-check on
                </p>
              </div>
            </FadeIn>

            <ArrowRight className="hidden md:block w-5 h-5 text-emerald-600 flex-shrink-0" />
            <ArrowDown className="md:hidden w-5 h-5 text-emerald-600 flex-shrink-0" />

            {/* Step 3: DM delivered in their inbox */}
            <FadeIn float={8} className="w-full max-w-sm md:w-72 [animation-delay:1.2s]">
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-slate-200/90 shadow-xl md:rotate-2 space-y-3 [backface-visibility:hidden]">
                <p className="text-[11px] font-bold tracking-[0.1em] text-emerald-700">
                  3 · DM IN THEIR INBOX
                </p>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl rounded-tl-sm p-3 space-y-1">
                  <p className="text-xs text-slate-800 font-medium leading-relaxed">
                    Here’s the guide you asked for ↓
                  </p>
                  <span className="text-xs font-bold text-emerald-700">↗ View the guide</span>
                </div>
              </div>
            </FadeIn>
          </div>
          <p className="mt-6 text-center text-[11px] font-semibold tracking-[0.08em] text-slate-400">
            ILLUSTRATIVE AUTOMATION
          </p>
        </div>

        {/* 4-Feature Capability Strip */}
        <FadeIn
          delay={0.35}
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 py-4 px-6 max-w-4xl mx-auto rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-sm text-xs font-semibold text-slate-800"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>Keyword DM Automation</span>
          </div>
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-teal-600" />
            <span>Story Reply Automation</span>
          </div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-cyan-600" />
            <span>Welcome DM Automation</span>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600" />
            <span>Claude & AI Agent Connectors</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
