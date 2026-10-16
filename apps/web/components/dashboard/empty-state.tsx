'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Instagram, Layers } from 'lucide-react';
import { Button } from '@autodm/ui';

interface EmptyStateProps {
  onConnect: () => void;
  onCreateCampaign: () => void;
}

export function EmptyState({ onConnect, onCreateCampaign }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden text-center space-y-6 max-w-2xl mx-auto my-6">
      {/* Background glow overlays */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-glow-gradient pointer-events-none opacity-20 blur-xl" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-mesh-gradient pointer-events-none opacity-20 blur-xl" />

      {/* Premium SVG Illustration */}
      <div className="relative w-48 h-40 flex items-center justify-center">
        {/* Animated Background Rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-32 h-32 rounded-full border border-primary/20 bg-primary/5 blur-sm"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="w-40 h-40 rounded-full border border-accent-cyan/10 bg-accent-cyan/5 blur-md"
          />
        </div>

        {/* Central Graphic */}
        <svg
          width="180"
          height="150"
          viewBox="0 0 180 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          {/* Dashboard Grid Background */}
          <path
            d="M10 20 H170 M10 50 H170 M10 80 H170 M10 110 H170"
            stroke="rgba(0,0,0,0.05)"
            strokeWidth="1"
          />
          <path
            d="M30 10 V140 M70 10 V140 M110 10 V140 M150 10 V140"
            stroke="rgba(0,0,0,0.05)"
            strokeWidth="1"
          />

          {/* Comment Bubble (Left) */}
          <motion.g
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <rect
              x="20"
              y="30"
              width="70"
              height="32"
              rx="10"
              fill="rgba(255, 255, 255, 0.9)"
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth="1"
            />
            <path
              d="M40 62 L40 68 L48 62 Z"
              fill="rgba(255, 255, 255, 0.9)"
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth="1"
            />
            {/* Comment Line previews */}
            <rect x="30" y="40" width="40" height="3" rx="1.5" fill="rgba(0,0,0,0.15)" />
            <rect x="30" y="48" width="50" height="3" rx="1.5" fill="rgba(0,0,0,0.25)" />
            {/* Trigger tag "INFO" */}
            <rect
              x="65"
              y="16"
              width="30"
              height="14"
              rx="4"
              fill="rgba(0, 187, 136, 0.15)"
              stroke="rgba(0, 187, 136, 0.3)"
              strokeWidth="1"
            />
            <text x="80" y="26" fill="#00BB88" fontSize="8" fontWeight="bold" textAnchor="middle">
              "info"
            </text>
          </motion.g>

          {/* Automation Arrow / Zap Link */}
          <motion.path
            d="M95 55 L115 65"
            stroke="#00BB88"
            strokeWidth="2"
            strokeDasharray="4 4"
            animate={{ strokeDashoffset: [-20, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          />

          {/* DM Sent Bubble (Right) */}
          <motion.g
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <rect
              x="90"
              y="70"
              width="70"
              height="32"
              rx="10"
              fill="rgba(0, 187, 136, 0.1)"
              stroke="rgba(0, 187, 136, 0.3)"
              strokeWidth="1"
            />
            <path
              d="M140 102 L140 108 L132 102 Z"
              fill="rgba(0, 187, 136, 0.1)"
              stroke="rgba(0, 187, 136, 0.3)"
              strokeWidth="1"
            />
            {/* DM Line previews */}
            <rect x="100" y="80" width="50" height="3" rx="1.5" fill="#00BB88" />
            <rect x="100" y="88" width="35" height="3" rx="1.5" fill="rgba(0,0,0,0.2)" />
          </motion.g>

          {/* Sparkles */}
          <motion.path
            d="M85 30 L87 35 L92 37 L87 39 L85 44 L83 39 L78 37 L83 35 Z"
            fill="#00BB88"
            animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M150 65 L151.5 68.5 L155 70 L151.5 71.5 L150 75 L148.5 71.5 L145 70 L148.5 68.5 Z"
            fill="#60a5fa"
            animate={{ scale: [1.2, 0.8, 1.2], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
          Supercharge your Instagram DMs
        </h2>
        <p className="text-xs text-slate-600 leading-normal">
          Welcome to DMPilot! Connect your Meta channel first, then construct your first
          Comment-to-DM or Keyword-to-DM trigger automation flow.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full max-w-xs sm:max-w-none justify-center">
        <Button
          onClick={onConnect}
          className="text-xs font-bold gap-2 bg-gradient-to-r from-primary to-accent-cyan hover:opacity-90 transition-all text-primary-foreground border-0 shadow-[0_0_15px_rgba(0,187,136,0.3)] cursor-pointer"
        >
          <Instagram className="h-4 w-4" />
          <span>Connect Instagram</span>
          <ArrowRight className="h-3 w-3" />
        </Button>
        <Button
          onClick={onCreateCampaign}
          className="text-xs font-bold gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#1E3A8A] hover:opacity-90 transition-all text-white border-0 shadow-[0_0_15px_rgba(29,78,216,0.2)] cursor-pointer"
        >
          <Layers className="h-4 w-4" />
          <span>Create Campaign</span>
        </Button>
      </div>
    </div>
  );
}
