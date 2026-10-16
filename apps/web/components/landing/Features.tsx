'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Smartphone,
  Check,
  X,
  ArrowRight,
  MessageSquare,
  Shuffle,
  Flame,
  Radio,
  CheckCircle,
} from 'lucide-react';
import { PWAInstallButton } from '@/components/pwa/pwa-install-button';
import { PWA_MOBILE_CONTENT } from '@/lib/landing-data';

export default function Features() {
  const stories = [
    {
      number: '01',
      tag: 'INSTANT ENGAGEMENT ENGINE',
      title: 'They ask for the link. You’re already on it.',
      description:
        'Turn viral Reel and post comments into clicks, leads, and sales before the buyer intent cools down. Whether they comment "LINK", "GUIDE", or "PRICE", DMPilot fires their direct link in under 400 milliseconds.',
      bullets: [
        'Instant sub-second direct message delivery (<400ms)',
        'Algorithmic public comment auto-reply to skyrocket organic reach',
        'Built-in link tracking with click & conversion analytics',
      ],
      previewBadge: 'Direct Message Delivered in 380ms',
      previewPrompt: 'User comments: "link please! where can I buy?"',
      previewReply:
        'DMPilot delivers: "Hey Rohit! Here is your exclusive 40% launch discount link:"',
      badgeColor: 'emerald',
    },
    {
      number: '02',
      tag: 'HUMAN-FEELING CONVERSATIONS',
      title: 'Make every message feel authentic and unique.',
      description:
        'No robotic repetitions that trigger spam flags. DMPilot rotates through multiple message variations, dynamic greetings, and personalized tags so every DM looks 100% genuine to Instagram and your followers.',
      bullets: [
        'Multi-variant message rotation & dynamic name tags',
        'Smart spintax support for infinite response combinations',
        'Works seamlessly on Reels, Feed Posts, and Carousels',
      ],
      previewBadge: 'Dynamic Rotation Active',
      previewPrompt: '3 comments received simultaneously',
      previewReply: '3 unique message variations dispatched with zero rate-limit risk',
      badgeColor: 'amber',
    },
    {
      number: '03',
      tag: 'ZERO FRICTION SETUP',
      title: 'Direct Instagram Pro login. No Facebook Page required.',
      description:
        'Skip the painful Facebook Business Manager linking and confusing permissions. Connect directly with your Instagram Creator or Business account in 1-click and start automating immediately.',
      bullets: [
        'Direct Instagram Professional OAuth 2.0 integration',
        'No Facebook Page or Business Manager linking required',
        'Official Meta Graph API certified for total safety',
      ],
      previewBadge: '1-Click Instagram OAuth',
      previewPrompt: 'Connect Account',
      previewReply: 'Authenticated directly via Instagram Professional API v20.0',
      badgeColor: 'sky',
    },
  ];

  return (
    <div id="features" className="space-y-24 sm:space-y-32 py-16 sm:py-24 relative z-10">
      {/* 1. ZORCHA-STYLE NUMBERED STORIES (01, 02, 03) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-20">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Built For Creators & Brands</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            How DMPilot transforms your engagement into revenue.
          </h2>
          <p className="text-slate-600 text-base">
            Every feature is designed to be frictionless, lightning fast, and 100% compliant with
            Meta policies.
          </p>
        </div>

        <div className="space-y-16 sm:space-y-24">
          {stories.map((story, idx) => {
            const isReverse = idx % 2 === 1;
            return (
              <motion.div
                key={story.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6 }}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center ${
                  isReverse ? 'lg:flex-row-reverse' : ''
                }`}
              >
                {/* Text Content */}
                <div
                  className={`space-y-6 ${isReverse ? 'lg:col-span-6 lg:order-2' : 'lg:col-span-6'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-black text-slate-400">
                      {story.number}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {story.tag}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    {story.title}
                  </h3>

                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                    {story.description}
                  </p>

                  <ul className="space-y-3 pt-2">
                    {story.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-700"
                      >
                        <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-emerald-600" />
                        </div>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual Preview Card */}
                <div className={`${isReverse ? 'lg:col-span-6 lg:order-1' : 'lg:col-span-6'}`}>
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="text-xs font-mono font-bold text-slate-500">
                        Automation Scene {story.number}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {story.previewBadge}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Inbound Trigger
                        </span>
                        <p className="text-xs font-medium text-slate-800">{story.previewPrompt}</p>
                      </div>

                      <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200/80 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                          System Execution (&lt;400ms)
                        </span>
                        <p className="text-xs font-medium text-slate-800">{story.previewReply}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 2. BEFORE VS AFTER COMPARISON (Zorcha style) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-12 space-y-3">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            The Difference with DMPilot
          </h2>
          <p className="text-slate-600 text-sm">
            Stop losing 80% of commenters to slow manual replies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Without DMPilot */}
          <div className="bg-slate-100/70 border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Without DMPilot</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800">Manual copy-pasting & lost revenue</h3>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-600">
              <li className="flex items-start gap-2.5">
                <X className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>Hours spent copying links by hand while comments pile up</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>80% drop-off because users lose interest after 10 minutes</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>High risk of account restriction for sending repetitive messages</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>Zero tracking of who actually clicked or bought</span>
              </li>
            </ul>
          </div>

          {/* With DMPilot */}
          <div className="bg-white border-2 border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>With DMPilot</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Recommended
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Instant conversions on complete autopilot
            </h3>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700 font-medium">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Sub-second DM delivery (&lt;400ms) right when purchase intent peaks</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>4x higher click-through rates and email list conversions</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>100% compliant with Meta Graph API & randomized variations</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Real-time delivery analytics and conversion tracking</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. PWA MOBILE APP SECTION */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 uppercase tracking-widest">
                <Smartphone className="w-3.5 h-3.5 text-primary" />
                {PWA_MOBILE_CONTENT.badge}
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {PWA_MOBILE_CONTENT.title}
              </h2>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
                {PWA_MOBILE_CONTENT.description}
              </p>

              <div className="pt-2">
                <PWAInstallButton variant="landing" />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              {PWA_MOBILE_CONTENT.features.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3.5 hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">{feat.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
