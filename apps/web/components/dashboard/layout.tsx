'use client';

import * as React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useShortcuts, toast } from '@autodm/ui';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationCenter } from './notification-center';
import { HelpGuideModal } from './help-guide-modal';
import { ContactModal } from './contact-modal';
import {
  LayoutDashboard,
  MessageSquareCode,
  Inbox,
  BarChart3,
  Settings,
  Shield,
  Zap,
  LogOut,
  X,
  HelpCircle,
  Mail,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { handleLogout } from '@/lib/auth-helpers';
import { apiRequest } from '@/lib/api-client';
import { PWAInstallButton } from '@/components/pwa/pwa-install-button';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isContactOpen, setIsContactOpen] = React.useState(false);
  const { data: session } = useSession();

  const [notifications, setNotifications] = React.useState<any[]>([]);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const data = await apiRequest<any[]>('/notifications');
      setNotifications(data || []);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, []);

  React.useEffect(() => {
    const hasToken = Boolean((session as any)?.accessToken);
    if (hasToken) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [session, fetchNotifications]);

  const unreadNotificationsCount = React.useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Creator';
  const userRole = session?.user?.role || 'Creator';
  const isAdmin = session?.user?.role === 'ADMIN';

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Automations', href: '/automations', icon: MessageSquareCode },
    { name: 'Inbox', href: '/inbox', icon: Inbox },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];
  const allNavItems = isAdmin
    ? [...navItems, { name: 'Admin', href: '/admin', icon: Shield }]
    : navItems;

  const navigateTo = (href: string) => {
    setIsMobileMenuOpen(false);
    router.push(href);
  };

  // Register global hotkeys
  useShortcuts([
    {
      keyConfig: { key: 'd', alt: true },
      callback: () => {
        router.push('/dashboard');
        toast.success('Navigated to Dashboard', { id: 'nav-toast' });
      },
    },
    {
      keyConfig: { key: 'a', alt: true },
      callback: () => {
        router.push('/automations');
        toast.success('Navigated to Automations', { id: 'nav-toast' });
      },
    },
    {
      keyConfig: { key: 'i', alt: true },
      callback: () => {
        router.push('/inbox');
        toast.success('Navigated to Inbox', { id: 'nav-toast' });
      },
    },
    {
      keyConfig: { key: 'l', alt: true },
      callback: () => {
        router.push('/analytics');
        toast.success('Navigated to Analytics', { id: 'nav-toast' });
      },
    },
    {
      keyConfig: { key: 's', alt: true },
      callback: () => {
        router.push('/settings');
        toast.success('Navigated to Settings', { id: 'nav-toast' });
      },
    },
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-transparent relative z-10">
      {/* Sidebar Navigation */}
      <Sidebar
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenContact={() => setIsContactOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <Header
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
        />

        {/* Scrollable Dashboard Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="relative z-10 max-w-7xl mx-auto space-y-6"
            >
              {/* Email Verification Banner */}
              {session?.user && session.user.isVerified === false && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
                  <div className="flex items-center space-x-2.5 text-amber-300">
                    <span className="flex-shrink-0 text-base">⚠️</span>
                    <div>
                      <strong className="font-bold text-amber-200">Email Not Verified:</strong>{' '}
                      Please verify your email address to ensure full account access and
                      deliverability.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const toastId = toast.loading('Sending verification email...');
                      try {
                        if (!session?.user?.email) {
                          throw new Error('User email not found in session');
                        }
                        await apiRequest('/auth/resend-verification', {
                          method: 'POST',
                          body: JSON.stringify({ email: session.user.email }),
                        });
                        toast.success('Verification link sent! Check your inbox.', { id: toastId });
                      } catch (err) {
                        const msg =
                          err instanceof Error ? err.message : 'Failed to send verification email';
                        toast.error(msg, { id: toastId });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold border border-amber-500/30 transition-all text-[11px] whitespace-nowrap cursor-pointer"
                  >
                    Resend Verification Link
                  </button>
                </div>
              )}

              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Sidebar Drawer overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
            />

            {/* Slide-out Sidebar Drawer content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-64 bg-white/95 backdrop-blur-xl border-r border-slate-200/80 shadow-2xl flex flex-col justify-between h-full p-4 z-10"
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-tr from-primary to-accent-cyan shadow-[0_0_12px_rgba(0,187,136,0.35)]">
                      <Zap className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">DMPilot</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Nav list */}
                <nav className="space-y-1.5 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                  {allNavItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <button
                        key={item.href}
                        onClick={() => navigateTo(item.href)}
                        className={`flex items-center w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-all relative overflow-hidden ${
                          isActive
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/70'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 w-1 h-4 rounded-r bg-primary shadow-[0_0_8px_#00bb88]" />
                        )}
                        <item.icon
                          className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-500'}`}
                        />
                        <span className="ml-3 truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Help & Contact buttons (Mobile) */}
              <div className="px-3 py-2 space-y-1 border-t border-slate-100 flex-shrink-0">
                <PWAInstallButton variant="sidebar" className="mb-1" />
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsHelpOpen(true);
                  }}
                  className="flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <HelpCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="ml-3 truncate">Help Guide</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsContactOpen(true);
                  }}
                  className="flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="ml-3 truncate">Contact Support</span>
                </button>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-xs font-bold text-slate-900 truncate">{userName}</span>
                    <span className="text-[9px] text-slate-500 truncate capitalize">
                      {userRole.toLowerCase()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications Drawer */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        setNotifications={setNotifications}
      />

      <HelpGuideModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
