'use client';

import * as React from 'react';
import { Download, Zap, X } from 'lucide-react';
import { usePWA } from './pwa-context';
import { motion, AnimatePresence } from 'framer-motion';

export interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'landing';
  className?: string;
  collapsed?: boolean;
}

export function PWAInstallButton({
  variant = 'sidebar',
  className = '',
  collapsed = false,
}: PWAInstallButtonProps) {
  const { isInstalled, installApp } = usePWA();

  // If already running inside standalone app, don't show install buttons
  if (isInstalled) {
    return null;
  }

  if (variant === 'sidebar') {
    return (
      <button
        onClick={() => installApp()}
        className={`flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all cursor-pointer ${
          collapsed ? 'justify-center px-0' : ''
        } ${className}`}
        title="Install DMPilot App"
      >
        <Download className="h-4 w-4 flex-shrink-0 text-emerald-400" />
        {!collapsed && <span className="ml-3 truncate font-medium">Install App</span>}
      </button>
    );
  }

  if (variant === 'landing') {
    return (
      <button
        onClick={() => installApp()}
        className={`inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-white font-bold text-sm shadow-brand hover:shadow-brand-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${className}`}
      >
        <Download className="w-4 h-4 text-white" />
        <span>Install DMPilot App</span>
      </button>
    );
  }

  return null;
}

/**
 * Mobile floating install banner prompt
 * Uses localStorage to persist dismissals so it never pesters the user repeatedly.
 */
export function PWAMobileBanner() {
  const { isInstalled, installApp } = usePWA();
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const isDismissed = localStorage.getItem('dmpilot_pwa_banner_dismissed') === 'true';
      if (!isDismissed && !isInstalled) {
        // Wait 4 seconds on mobile before subtle entrance
        const timer = setTimeout(() => setDismissed(false), 4000);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage access restrictions in private mode
    }
  }, [isInstalled]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('dmpilot_pwa_banner_dismissed', 'true');
    } catch {
      // Ignore
    }
  };

  const handleInstallClick = () => {
    try {
      localStorage.setItem('dmpilot_pwa_banner_dismissed', 'true');
    } catch {
      // Ignore
    }
    setDismissed(true);
    installApp();
  };

  if (dismissed || isInstalled) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed bottom-4 left-4 right-4 z-50 md:hidden bg-[#0F141C]/95 border border-primary/30 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">Install DMPilot</h4>
            <p className="text-[11px] text-gray-400 truncate">1-tap home screen access & alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 rounded-xl bg-primary text-black font-bold text-xs shadow-md shadow-primary/20 active:scale-95 transition-all"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
