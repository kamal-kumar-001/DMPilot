'use client';

import * as React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { ShieldCheck, Lock } from 'lucide-react';
import { PRIVACY_CONTENT } from '@/lib/landing-data';

export default function PrivacyPage() {
  return (
    <div className="bg-[#FAF9F5] min-h-screen text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-32 space-y-12 relative z-10">
        {/* Page Title */}
        <div className="space-y-4 border-b border-slate-200 pb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
            <Lock className="h-4 w-4 text-primary" />
            <span>Secure Webhook Encryption</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            {PRIVACY_CONTENT.title}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed max-w-xl">
            {PRIVACY_CONTENT.lastUpdated}. This policy explains how your Instagram data is handled
            when you use DMPilot.
          </p>
        </div>

        {/* Philosophy Callout */}
        <div className="bg-white border border-emerald-200 rounded-3xl p-6 flex flex-col sm:flex-row items-start gap-4 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-base">Privacy Commitment</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {PRIVACY_CONTENT.commitment}
            </p>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-10 text-sm sm:text-base text-slate-700 leading-relaxed">
          {PRIVACY_CONTENT.sections.map((section) => (
            <section
              key={section.id}
              className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4"
            >
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
                <span className="text-primary">{section.id}.</span>
                <span>{section.title}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{section.desc}</p>
              {section.bullets.length > 0 && (
                <ul className="list-disc pl-6 space-y-2 text-xs sm:text-sm text-slate-600">
                  {section.bullets.map((bullet, idx) => (
                    <li key={idx}>
                      <strong className="text-slate-900">{bullet.split(':')[0]}:</strong>
                      {bullet.split(':')[1]}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
