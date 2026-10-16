'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Sparkles, Check, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '@autodm/ui';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  currentCount?: number;
  maxLimit?: number;
}

export function UpgradeModal({
  isOpen,
  onClose,
  title = 'Campaign Limit Reached',
  description = 'You have reached the maximum allowed campaigns on your current plan. Upgrade to Pro to unlock unlimited automation campaigns and advanced growth features!',
  currentCount = 1,
  maxLimit = 1,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden space-y-6"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Header */}
          <div className="flex flex-col items-center text-center space-y-3 pt-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/10 to-accent-cyan/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Zap className="w-7 h-7 text-primary animate-pulse" />
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-black uppercase text-amber-700 tracking-wider">
              Quota Reached ({currentCount} / {maxLimit})
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs">{description}</p>
          </div>

          {/* Pro Benefits Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs text-slate-700">
            <p className="font-bold text-primary flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Unlock with Pro Plan:
            </p>
            <div className="space-y-2 font-medium">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>
                  <strong className="text-slate-900 font-bold">Unlimited Active Campaigns</strong> &
                  DMs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>Anti-Spam Copy Variation Rotation</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>Follow-to-Unlock Quick Reply Gate</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>✨ No DMPilot Branding (Whitelabel DMs)</span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-2.5 pt-1">
            <Link
              href="/pricing"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-white font-black text-xs text-center flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-all transform hover:scale-[1.01] block"
            >
              <span>Upgrade to Pro Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 text-center cursor-pointer transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
