'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Link, Layers, PlayCircle, HelpCircle, CheckCircle } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpGuideModal({ isOpen, onClose }: HelpGuideModalProps) {
  const steps = [
    {
      title: '1. Set Instagram to Professional',
      description:
        'Open the Instagram app on your mobile device, navigate to Settings, and switch your profile type to a Business or Creator account. Meta does not support automation for personal profiles.',
      icon: HelpCircle,
    },
    {
      title: '2. Direct Instagram Login',
      description:
        'Log in directly using your Instagram Professional account credentials. No Facebook login or Facebook Page required.',
      icon: Link,
    },
    {
      title: '3. Connect on DMPilot',
      description:
        'Go to Settings -> Account in your DMPilot dashboard. Click "Connect Instagram" to log in. Authorize permissions to your Instagram Professional profile.',
      icon: CheckCircle,
    },
    {
      title: '4. Create & Launch Campaigns',
      description:
        'Navigate to Automations -> Create Campaign. Configure trigger keywords (EXACT or CONTAINS), set up direct message templates (with tags like {username}), and launch to start automating instantly!',
      icon: Layers,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="fixed inset-0 m-auto max-w-2xl h-fit max-h-[85vh] overflow-y-auto glass-card border border-white/10 bg-[#0c0d14]/90 rounded-3xl p-6 md:p-8 z-50 shadow-2xl space-y-6 custom-scrollbar"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">Creator Setup Guide</h3>
                  <p className="text-xs text-gray-500">
                    Follow these simple steps to link your profile and activate DM automation.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all duration-300 space-y-2.5"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {step.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>

            {/* Video/visual helper text */}
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 text-center">
              <p className="text-[10px] text-gray-400">
                💡 <strong>Need Help?</strong> Click on the "Contact Support" option in your sidebar
                to open a ticket directly with our engineering team, and we will get you linked!
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
