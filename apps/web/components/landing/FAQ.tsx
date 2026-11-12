'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { FAQS_CONTENT } from '@/lib/landing-data';

export default function FAQ() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 sm:py-32 relative">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently asked{' '}
            <span className="bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
              questions
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Everything you need to know about DMPilot triggers and Meta compliance.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-4 max-w-3xl mx-auto mb-16 [overflow-anchor:none]">
          {FAQS_CONTENT.items.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl overflow-hidden border transition-[border-color,box-shadow,background-color] duration-200 ${
                  isOpen
                    ? 'border-emerald-300 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-md'
                    : 'border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/70 hover:border-slate-300 shadow-sm'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${idx}`}
                  className="flex w-full justify-between items-center p-5 sm:p-6 gap-4 select-none text-left cursor-pointer"
                >
                  <span className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-primary' : 'text-slate-400'
                    }`}
                  />
                </button>

                <div
                  id={`faq-panel-${idx}`}
                  role="region"
                  className="dm-faq-panel"
                  data-open={isOpen}
                  aria-hidden={!isOpen}
                >
                  <div>
                    <div className="px-5 sm:px-6 pb-6 pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
