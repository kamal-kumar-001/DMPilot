'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Link2, Sparkles, Layers, ArrowRight } from 'lucide-react';

export default function SetupGuide() {
  const steps = [
    {
      step: '01',
      title: 'Connect your Instagram Pro Account',
      desc: 'Log in directly with your Instagram Creator or Business account. Zero Facebook login or Facebook Page linking required.',
      icon: Link2,
    },
    {
      step: '02',
      title: 'Pick your post & keyword',
      desc: 'Select any Reel, carousel, or feed post. Choose your trigger keyword (e.g., "LINK") and craft your personalized DM reply with buttons.',
      icon: Sparkles,
    },
    {
      step: '03',
      title: 'Publish & automate 24/7',
      desc: 'Activate the campaign with one click. DMPilot sends instant sub-second DMs to every commenter around the clock.',
      icon: Layers,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28 relative border-t border-slate-200/80 bg-white/70 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16 space-y-4"
        >
          <span className="px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 uppercase tracking-widest">
            3-Minute Setup
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            How to set up Instagram DM automation.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            No complex developer tools or webhook configurations. Start converting your comments in
            3 simple steps.
          </p>
        </motion.div>

        {/* Steps Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-black text-slate-300 font-mono">{s.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick CTA footer */}
        <div className="mt-14 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-bold text-sm shadow-brand hover:shadow-brand-lg transition-all cursor-pointer"
          >
            <span>Start Automating for Free</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </Link>
        </div>
      </div>
    </section>
  );
}
