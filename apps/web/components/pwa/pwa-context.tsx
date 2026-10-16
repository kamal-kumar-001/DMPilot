'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, PlusSquare, X, Zap, CheckCircle, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAContextValue {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  installApp: () => Promise<void>;
  openInstallGuide: () => void;
}

const PWAContext = React.createContext<PWAContextValue>({
  isInstallable: false,
  isInstalled: false,
  isIOS: false,
  installApp: async () => {},
  openInstallGuide: () => {},
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [showIOSModal, setShowIOSModal] = React.useState(false);

  // Register Service Worker and initialize PWA event listeners
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode (already installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Check for iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Register Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('PWA ServiceWorker registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('PWA ServiceWorker registration failed:', err);
          });
      });
    }

    // Capture beforeinstallprompt (Chromium / Edge / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('DMPilot PWA successfully installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = React.useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('PWA install prompt error:', err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers without beforeinstallprompt or desktop Safari/Firefox
      setShowIOSModal(true);
    }
  }, [deferredPrompt, isIOS]);

  const isInstallable = !isInstalled && (Boolean(deferredPrompt) || isIOS);

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isIOS,
        installApp,
        openInstallGuide: () => setShowIOSModal(true),
      }}
    >
      {children}

      {/* iOS / General Install Guide Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-[#0F141C] border border-white/10 rounded-2xl p-6 shadow-2xl text-white overflow-hidden"
            >
              {/* Decorative top glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#00BB88] to-transparent" />

              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00BB88] to-[#00E5FF] flex items-center justify-center shadow-lg shadow-[#00BB88]/20 flex-shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Install DMPilot App</h3>
                    <p className="text-xs text-gray-400">
                      Fast, offline-ready native app experience
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <div className="mt-5 space-y-4">
                  <p className="text-xs text-gray-300">
                    Install DMPilot on your iPhone or iPad in 2 quick steps:
                  </p>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-7 h-7 rounded-lg bg-[#00BB88]/20 text-[#00BB88] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      1
                    </div>
                    <div className="text-xs text-gray-200">
                      Tap the <strong className="text-white">Share</strong> button in Safari's
                      bottom toolbar:
                      <div className="mt-1 flex items-center gap-1.5 text-[#00E5FF] font-medium">
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share icon</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-7 h-7 rounded-lg bg-[#00BB88]/20 text-[#00BB88] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      2
                    </div>
                    <div className="text-xs text-gray-200">
                      Scroll down and tap{' '}
                      <strong className="text-white">"Add to Home Screen"</strong>:
                      <div className="mt-1 flex items-center gap-1.5 text-[#00E5FF] font-medium">
                        <PlusSquare className="w-3.5 h-3.5" />
                        <span>Add to Home Screen</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <p className="text-xs text-gray-300">
                    To install DMPilot on your browser or device:
                  </p>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-200 space-y-2">
                    <p className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00BB88] flex-shrink-0" />
                      <span>
                        Click the <strong>Install</strong> icon in your browser address bar
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00BB88] flex-shrink-0" />
                      <span>
                        Or open browser menu (⋮ or ⋯) and select <strong>"Install DMPilot"</strong>
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00BB88] to-[#00A877] text-white text-xs font-bold shadow-lg shadow-[#00BB88]/20 hover:opacity-95 transition-all"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PWAContext.Provider>
  );
}

export function usePWA() {
  return React.useContext(PWAContext);
}
