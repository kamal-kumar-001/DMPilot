'use client';

import * as React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { AmbientBackground } from '@/components/landing/AmbientBackground';
import { Mail, Globe, Instagram, Linkedin, MessageSquare, MapPin } from 'lucide-react';
import { ABOUT_CONTENT } from '@/lib/landing-data';

export default function ContactPage() {
  const dev = ABOUT_CONTENT.developer;

  return (
    <div className="bg-[#FAF9F5] min-h-screen text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900 relative overflow-x-hidden">
      <AmbientBackground />
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-32 space-y-16 relative z-10">
        {/* Page Title */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Get in Touch</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            We'd love to hear from you.
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Have questions about campaign integrations, custom agency plans, or API limits? Drop us
            a line and we'll get back to you shortly.
          </p>
        </div>

        {/* Contact Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card 1: Email */}
          <a
            href={`mailto:${dev.email}`}
            className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Email Support</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Send us an email. We typically respond within 24 business hours.
              </p>
              <p className="text-xs font-bold text-primary pt-1 font-mono">{dev.email}</p>
            </div>
          </a>

          {/* Card 2: Developer Channels */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-accent-cyan flex-shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-base font-bold text-slate-900">
                Engineering & Founder ({dev.name})
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct inquiries regarding architecture and partnership:
              </p>
              <div className="flex gap-2 pt-1">
                <a
                  href={dev.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="LinkedIn Profile"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href={dev.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Instagram Profile"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Office Location */}
        <div className="max-w-md mx-auto text-center space-y-2 text-xs text-slate-500 pt-8 border-t border-slate-200">
          <div className="flex items-center justify-center gap-1.5 text-slate-700 font-semibold">
            <MapPin className="w-4 h-4 text-primary" />
            <span>{ABOUT_CONTENT.companyAddress}</span>
          </div>
          <p>DMPilot Technologies Inc. • Built for creators across India.</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
