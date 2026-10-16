'use client';

import * as React from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { AmbientBackground } from '@/components/landing/AmbientBackground';
import { Compass, Code2, Linkedin } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="bg-[#FAF9F5] min-h-screen text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900 relative overflow-x-hidden">
      {/* Full-Page Ambient Background Grid & Gradient */}
      <AmbientBackground />

      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-32 space-y-20 relative z-10">
        {/* Intro Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
            <Compass className="h-4 w-4 text-primary" />
            <span>Our Mission</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Seamless Automation. <br />
            <span className="bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
              Meta-Compliant Delivery.
            </span>
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            DMPilot was engineered to solve a critical creator challenge: instantly connecting with
            commenters on Instagram posts and Reels without risking account integrity or relying on
            unofficial scraping.
          </p>
        </div>

        {/* Philosophy grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <div className="bg-gradient-to-br from-white via-white to-emerald-50/40 rounded-3xl p-8 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Scale Engagement Effortlessly</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Creators spend hours answering comments with links. DMPilot automates this hand-off
                instantly. By delivering links directly to DMs, we boost CTR and drive conversion
                without adding work to your day.
              </p>
            </div>
            <div className="text-xs text-primary font-mono font-bold">
              // Turn engagement into pipeline.
            </div>
          </div>

          <div className="bg-gradient-to-br from-white via-white to-cyan-50/40 rounded-3xl p-8 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-accent-cyan">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Meta Compliant Core</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                We operate strictly within Meta Graph API v20.0 endpoints. Your access tokens are
                securely managed at rest, and webhook dispatches comply fully with Instagram
                Platform Policies.
              </p>
            </div>
            <div className="text-xs text-accent-cyan font-mono font-bold">
              // 100% Meta API Verified.
            </div>
          </div>
        </div>

        {/* Architecture details */}
        <div className="bg-gradient-to-br from-white via-white to-emerald-50/30 rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-sm space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">
              Engineered for Social Commerce & Creator Growth
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              DMPilot natively processes Hinglish, Tanglish, and regional multilingual nuances. Our
              intent engine detects buyer signals whether your audience asks "bhai price kya hai" or
              "send link", routing them directly to your checkout or lead capture funnel.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-2xl font-black text-slate-900">&lt;400ms</p>
              <p className="text-xs text-slate-500 font-medium">Webhook Execution Latency</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-2xl font-black bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
                99.9%
              </p>
              <p className="text-xs text-slate-500 font-medium">Platform Uptime SLA</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-2xl font-black text-slate-900">10+ Regional</p>
              <p className="text-xs text-slate-500 font-medium">Languages & Dialects</p>
            </div>
          </div>
        </div>

        {/* Founder Card */}
        <div className="bg-gradient-to-br from-white via-white to-emerald-50/50 rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center text-white text-2xl font-black shadow-brand flex-shrink-0">
              K
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Founder & Architect
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900">KAMAL</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Building mission-critical creator infrastructure and automated social commerce
                systems designed for maximum conversion and Meta-compliant reliability.
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-4 pt-2">
                <a
                  href="https://www.linkedin.com/in/kamalkhatiwal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shadow-sm"
                >
                  <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                  <span>LinkedIn</span>
                </a>
                <a
                  href="https://www.instagram.com/kamal_khatiwal/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shadow-sm"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 inline-block flex-shrink-0" />
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
