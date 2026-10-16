'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Play,
  Sparkles,
  Zap,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  Heart,
  MessageCircle,
} from 'lucide-react';

export default function Hero() {
  const { data: session } = useSession();

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-16">
        {/* Top Center Value Proposition (Zorcha style) */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Eyebrow Pill */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/90 shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-800 tracking-wide uppercase">
              ✦ Meta-Approved Instagram DM Engine
            </span>
          </motion.div>

          {/* High-Impact Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08]"
          >
            Your Instagram comments <br className="hidden sm:inline" />
            have somewhere to go.
          </motion.h1>

          {/* Subtitle / Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-600 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto font-normal"
          >
            They ask for the link. You’re already on it. Deliver links, discount codes, guides, and
            lead magnets directly into their DMs in under a second.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            <Link
              href={session ? '/dashboard' : '/register'}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-bold text-base shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <span>{session ? 'Go to Dashboard' : 'Start Free Today'}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-base transition-all shadow-xs hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span>See How It Works</span>
            </a>
          </motion.div>
        </div>

        {/* Zorcha-Style Feature Highlight Strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 py-5 px-6 max-w-4xl mx-auto rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-sm text-xs font-semibold text-slate-800"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-teal-500" />
            <span>Instant Sub-Second Delivery (&lt;400ms)</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% Meta Graph API Safe</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-600" />
            <span>Direct Instagram Pro Login</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>No Facebook Page Required</span>
          </div>
        </motion.div>

        {/* Crisp Non-Blurry Dual Card Mockup (Instagram Post Comment ➔ Instant DM Delivery) */}
        <div className="max-w-4xl mx-auto relative pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left Card: Instagram Reel / Post Comment */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-lg relative space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 p-[2px]">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[10px] font-black text-rose-600">
                      DP
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-none">@your_brand</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Instagram Reel</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500">12.4k views</span>
              </div>

              {/* Reel Preview Container */}
              <div className="h-44 rounded-2xl bg-gradient-to-tr from-slate-100 via-slate-50 to-teal-50/50 border border-slate-200/80 p-4 flex flex-col justify-end relative overflow-hidden">
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-bold text-white flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  <span>Reel #42</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  "Comment 'LINK' below and I will DM you the secret supplier list!"
                </p>
              </div>

              {/* Inbound Comment Bubble */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  R
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">@rohit_kumar</span>
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  </div>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">
                    "LINK please! Need this for my store 🙏"
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Just now</span>
                </div>
              </div>
            </div>

            {/* Right Card: Instant DM Sent on Autopilot */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xl relative space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    LIVE • Meta Verified
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-medium">
                  Response time: 380ms
                </span>
              </div>

              {/* Chat Message Window */}
              <div className="space-y-3 py-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                    DM
                  </div>
                  <span className="text-xs font-bold text-slate-900">DMPilot Automated Reply</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    DELIVERED ✓
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-sm p-4 space-y-3">
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    Hey Rohit! 🎉 Here is your direct link to the secret supplier list + your 20%
                    discount code:
                  </p>

                  <div className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer">
                    <span>Access Supplier Directory</span>
                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                {/* Algorithmic Public Reply */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-950 font-medium flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>
                    Public comment also auto-replied: "Sent to your DM! Check request folder 🚀"
                  </span>
                </div>
              </div>

              {/* Metrics Ticker */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Delivered
                  </p>
                  <p className="text-base font-black text-slate-900">24,891+</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Latency
                  </p>
                  <p className="text-base font-black text-emerald-600">380ms</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    CTR
                  </p>
                  <p className="text-base font-black text-slate-900">42.6%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
