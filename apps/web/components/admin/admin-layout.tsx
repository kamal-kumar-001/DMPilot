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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Admin left sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col h-screen border-r border-red-500/10 bg-[#0c0506]/60 backdrop-blur-md sticky top-0 left-0 w-[240px] overflow-hidden select-none flex-shrink-0 z-40">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-red-500/10 flex-shrink-0">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.35)] flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-extrabold bg-gradient-to-r from-white via-white to-red-400 bg-clip-text text-transparent truncate">
              Admin Portal
            </span>
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
                  'flex items-center w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-all relative overflow-hidden',
                  isActive
                    ? 'text-red-400 bg-white/5 font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                )}
              >
                {isActive && (
                  <div className="absolute left-0 w-1 h-4 rounded-r bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                )}
                <item.icon
                  className={cn(
                    'h-4.5 w-4.5 flex-shrink-0 transition-colors',
                    isActive ? 'text-red-400' : 'text-gray-400',
                  )}
                />
                <span className="ml-3 truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Return dashboard & profile */}
        <div className="p-3 border-t border-red-500/10 flex-shrink-0 space-y-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center justify-center w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-2" />
            <span>User Dashboard</span>
          </button>

          <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-bold text-white truncate">{userName}</span>
                <span className="text-[9px] text-gray-500 truncate uppercase">{userRole}</span>
              </div>
            </div>
            <button
              onClick={() => handleLogout()}
              className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/5"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="h-16 border-b border-red-500/10 bg-[#0c0506]/30 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 text-gray-400 hover:text-white transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                Admin
              </span>
              <span className="text-xs text-gray-500">/</span>
              <span className="text-xs text-white font-extrabold capitalize">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="hidden sm:flex items-center px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-xs text-gray-300 hover:text-white font-bold transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </header>

        {/* Scrollable Admin Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 relative">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/5 pointer-events-none rounded-full blur-[100px] z-0" />

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
              className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
            />

            {/* Slide-out Sidebar Drawer content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-64 bg-[#0a0506]/95 border-r border-red-500/10 flex flex-col justify-between h-full p-4 z-10"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-red-500/10 mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]">
                      <Shield className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-sm font-extrabold text-white">Admin Portal</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabSelect(item.id)}
                        className={cn(
                          'flex items-center w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-all relative overflow-hidden',
                          isActive
                            ? 'text-red-400 bg-white/5 font-semibold'
                            : 'text-gray-400 hover:text-white hover:bg-white/5',
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 w-1 h-4 rounded-r bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        )}
                        <item.icon
                          className={cn(
                            'h-4.5 w-4.5 flex-shrink-0',
                            isActive ? 'text-red-400' : 'text-gray-400',
                          )}
                        />
                        <span className="ml-3 truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-red-500/10 space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push('/dashboard');
                  }}
                  className="flex items-center justify-center w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                  <span>User Dashboard</span>
                </button>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="text-xs font-bold text-white truncate">{userName}</span>
                      <span className="text-[9px] text-gray-500 truncate uppercase">
                        {userRole}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/5"
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
