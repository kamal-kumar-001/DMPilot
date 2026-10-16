'use client';

import * as React from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { FOOTER_CONTENT } from '@/lib/landing-data';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/90 relative overflow-hidden py-16 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Main Grid Content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Logo Brand Segment */}
          <div className="col-span-2 space-y-4 pr-0 md:pr-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center shadow-brand">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-extrabold text-slate-900 tracking-tight">
                {FOOTER_CONTENT.brand}
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              {FOOTER_CONTENT.tagline}
            </p>
            {/* Social media icons */}
            <div className="flex gap-2.5 pt-2">
              {FOOTER_CONTENT.socials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm"
                    title={social.name}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links Columns */}
          {FOOTER_CONTENT.columns.map((column) => (
            <div key={column.title} className="space-y-4">
              <p className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                {column.title}
              </p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom copyright line */}
        <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>{FOOTER_CONTENT.copyright}</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:text-slate-600 transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
