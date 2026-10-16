'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
        <div className="space-y-4 max-w-3xl mx-auto mb-16">
          {FAQS_CONTENT.items.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                onClick={() => toggle(idx)}
                className={`rounded-2xl cursor-pointer overflow-hidden border transition-all duration-200 ${
                  isOpen
                    ? 'border-emerald-300 bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center p-5 sm:p-6 gap-4 select-none">
                  <span className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    {faq.q}
                  </span>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown
                      className={`w-5 h-5 ${isOpen ? 'text-primary' : 'text-slate-400'}`}
                    />
                  </motion.div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
