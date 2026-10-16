'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  handle: string;
  followers: string;
  text: string;
  rating: number;
  highlightResult: string;
  growthMetric: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Ishita Tech',
    handle: '@ishita.designs',
    followers: '180K Followers',
    text: "DMPilot completely changed my launch workflow. I used to stay up manually DM'ing resource links to thousands of commenters. Now, the ebooks deliver in 400ms automatically. Outstanding!",
    rating: 5,
    highlightResult: 'Saved 12 hrs/week',
    growthMetric: '+4,200 leads',
  },
  {
    id: '2',
    name: 'Kabir Vlogs',
    handle: '@kabir_travels',
    followers: '320K Followers',
    text: 'Meta-compliance was my biggest worry with other DM tools. DMPilot runs entirely through the official Meta Graph API. My engagement is up 140% and my account is 100% safe.',
    rating: 5,
    highlightResult: '140% Engagement Boost',
    growthMetric: '2.5x DM CTR',
  },
  {
    id: '3',
    name: 'Aanya Sharma',
    handle: '@aanya_coaches',
    followers: '95K Followers',
    text: 'The follow-check gate is pure gold. Non-followers get prompted to follow before they receive my templates. It helped me grow my follower base by 8,000 active fans in 3 weeks!',
    rating: 5,
    highlightResult: '+8k followers added',
    growthMetric: '92% conversion rate',
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 px-6 relative">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Loved by fast-growing{' '}
            <span className="bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
              creators
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            See how top creators convert viral reels into automated customer relationships.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex text-amber-400 gap-1">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">"{t.text}"</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{t.handle}</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {t.growthMetric}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
