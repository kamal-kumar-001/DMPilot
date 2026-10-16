'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Link2, Sparkles, Layers, CheckCircle } from 'lucide-react';

export default function SetupGuide() {
  const steps = [
    {
      step: '01',
      title: 'Professional Account',
      desc: 'Switch your Instagram profile type to a Business or Creator account. Meta does not support automation for personal profiles.',
      icon: Sparkles,
    },
    {
      step: '02',
      title: 'Link Facebook Page',
      desc: 'Link your Instagram account directly to your Facebook Page in your Instagram Profile settings -> Page.',
      icon: Link2,
    },
    {
      step: '03',
      title: 'Authorize DMPilot',
      desc: 'Navigate to Settings -> Connected Accounts in DMPilot. Click "Connect Instagram" and authorize access in the official Meta dialog.',
      icon: CheckCircle,
    },
    {
      step: '04',
      title: 'Launch Campaign',
      desc: 'Click "Create Campaign" on the Automations tab, select your target post or keyword, compose your DMs, and activate your campaign!',
      icon: Layers,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32 relative border-t border-slate-200/80 bg-white/70 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-20 space-y-4"
        >
          <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 uppercase tracking-widest">
            Step-by-step Setup
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            How to get started with{' '}
            <span className="bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
              DMPilot
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Link your account, configure your automation campaigns, and start driving conversions
            instantly.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-black text-slate-300 font-mono">{s.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
