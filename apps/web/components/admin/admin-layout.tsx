'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { handleLogout } from '@/lib/auth-helpers';
import {
  Shield,
  Users,
  Layers,
  Trash2,
  CreditCard,
  FileText,
  Server,
  Flag,
  Activity,
  LogOut,
  Zap,
  ArrowLeft,
  Menu,
  X,
  Bell,
  BarChart3,
  Megaphone,
  LifeBuoy,
  Radio,
} from 'lucide-react';
import { cn, toast } from '@autodm/ui';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export function AdminLayout({ children, activeTab, setActiveTab }: AdminLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Admin';
  const userRole = session?.user?.role || 'ADMIN';

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'creators', name: 'Creators', icon: Users },
    { id: 'campaigns', name: 'Campaigns', icon: Layers },
    { id: 'webhooks', name: 'Webhooks Audit', icon: Radio },
    { id: 'delete-requests', name: 'Delete Requests', icon: Trash2 },
    { id: 'plans', name: 'Billing Plans', icon: CreditCard },
    { id: 'logs', name: 'Audit Logs', icon: FileText },
    { id: 'queue', name: 'Job Queue', icon: Server },
    { id: 'flags', name: 'Feature Flags', icon: Flag },
    { id: 'monitoring', name: 'Monitoring', icon: Activity },
    { id: 'promotions', name: 'Promotions', icon: Megaphone },
    { id: 'support', name: 'Support Tickets', icon: LifeBuoy },
  ];

  const handleTabSelect = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      {/* Admin left sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col h-screen border-r border-slate-200/80 bg-white/85 backdrop-blur-xl sticky top-0 left-0 w-[240px] overflow-hidden select-none flex-shrink-0 z-40 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200/80 flex-shrink-0">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-tr from-rose-600 to-red-500 shadow-sm flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-extrabold text-slate-900 truncate">Admin Portal</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabSelect(item.id)}
                className={cn(
                  'flex items-center w-full px-3 py-2 rounded-lg text-xs font-medium transition-all relative overflow-hidden',
                  isActive
                    ? 'text-rose-700 bg-rose-50/90 font-semibold border border-rose-200/70 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70',
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r bg-rose-600" />
                )}
                <item.icon
                  className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-600',
                  )}
                />
                <span className="ml-3 truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Return dashboard & profile */}
        <div className="p-3 border-t border-slate-200/80 flex-shrink-0 space-y-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center justify-center w-full px-3 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-2" />
            <span>User Dashboard</span>
          </button>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs flex-shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-bold text-slate-800 truncate">{userName}</span>
                <span className="text-[9px] text-slate-500 truncate uppercase font-semibold">
                  {userRole}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleLogout()}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 transition-colors"
              title="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                Admin
              </span>
              <span className="text-xs text-slate-300">/</span>
              <span className="text-xs text-slate-800 font-extrabold capitalize">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="hidden sm:flex items-center px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-xs text-slate-700 hover:text-slate-900 font-semibold shadow-xs transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </header>

        {/* Scrollable Admin Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 relative">
          <div className="relative z-10 max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>

      {/* Mobile Drawer (Admin) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm cursor-pointer"
            />

            {/* Slide-out Sidebar Drawer content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-64 bg-white border-r border-slate-200 shadow-2xl flex flex-col justify-between h-full p-4 z-10"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-tr from-rose-600 to-red-500 shadow-sm">
                      <Shield className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">Admin Portal</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabSelect(item.id)}
                        className={cn(
                          'flex items-center w-full px-3 py-2 rounded-lg text-xs font-medium transition-all relative overflow-hidden',
                          isActive
                            ? 'text-rose-700 bg-rose-50 font-semibold border border-rose-200/70 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70',
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r bg-rose-600" />
                        )}
                        <item.icon
                          className={cn(
                            'h-4 w-4 flex-shrink-0',
                            isActive ? 'text-rose-600' : 'text-slate-400',
                          )}
                        />
                        <span className="ml-3 truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push('/dashboard');
                  }}
                  className="flex items-center justify-center w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                  <span>User Dashboard</span>
                </button>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs flex-shrink-0">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="text-xs font-bold text-slate-800 truncate">{userName}</span>
                      <span className="text-[9px] text-slate-500 truncate uppercase font-semibold">
                        {userRole}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
