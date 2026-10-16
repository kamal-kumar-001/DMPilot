'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { INNOVATIONS_CONTENT, PWA_MOBILE_CONTENT, PERSONAS_CONTENT } from '@/lib/landing-data';
import { Sparkles, MessageCircle, Flame, BellRing, Check } from 'lucide-react';

export default function Features() {
  const [activeTab, setActiveTab] = React.useState(0);
  const activeItem = INNOVATIONS_CONTENT.items[activeTab];

  return (
    <div className="space-y-24 py-16 sm:py-24 relative">
      {/* 1. SIX INNOVATIONS INTERACTIVE SHOWCASE */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            {INNOVATIONS_CONTENT.badge}
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Six Innovations Built for <br />
            <span className="bg-gradient-to-r from-primary via-emerald-600 to-accent-cyan bg-clip-text text-transparent">
              Hinglish Social Commerce
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            {INNOVATIONS_CONTENT.description}
          </p>
        </div>

        {/* Slideable & Scrollable Tab Selector Bar */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-start lg:justify-center gap-3 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-3 px-6 sm:px-10 max-w-full">
            {INNOVATIONS_CONTENT.items.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === idx;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(idx)}
                  className={`flex items-center gap-2.5 px-4 sm:px-5 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 min-w-max ${
                    idx === 0 ? 'ml-2 sm:ml-0' : ''
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-primary to-accent-cyan text-white shadow-brand scale-[1.02]'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-primary'}`} />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Crisp Permanent Feature Highlight Card */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-5xl mx-auto bg-white rounded-3xl p-6 sm:p-10 relative overflow-hidden border border-slate-200 shadow-xl"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeItem.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              {/* Left Column: Specs & Copy */}
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 uppercase">
                    Feature {activeItem.number} / 06
                  </span>
                  <span className="text-xs font-bold text-slate-500">{activeItem.subtitle}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  {activeItem.title}
                </h3>

                <p className="text-sm text-slate-600 leading-relaxed">{activeItem.desc}</p>

                <ul className="space-y-2 pt-2 text-xs text-slate-700 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Instant real-time execution with Meta Graph API v20.0</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Zero manual setup required • Auto-configured in 60 seconds</span>
                  </li>
                </ul>
              </div>

              {/* Right Column: Visual Demo Box */}
              <div className="lg:col-span-6 bg-[#FAF9F5] border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Live Demo Simulation
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    Active
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-xs space-y-1">
                    <p className="font-bold text-slate-900">User Comment:</p>
                    <p className="text-slate-600 italic">
                      "sir course details aur discount link bhejna"
                    </p>
                  </div>
                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-xs space-y-1">
                    <p className="font-bold text-emerald-900">
                      AI Intent Detected (PRICE / ENQUIRY):
                    </p>
                    <p className="text-slate-700 font-mono text-[11px]">
                      Trigger: Keyword match ➔ Instant private DM sent with link.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </section>

      {/* 2. PERSONAS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built for High-Growth Instagram Teams
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            From solo content creators to digital performance agencies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PERSONAS_CONTENT.items.map((persona, i) => {
            const Icon = persona.icon;
            return (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{persona.type}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{persona.desc}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                    {persona.stat}
                  </span>
                  <span className="text-slate-400 font-medium">{persona.creatorHandle}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
