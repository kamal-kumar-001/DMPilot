'use client';

import * as React from 'react';
import {
  LayoutDashboard,
  MessageSquareCode,
  Inbox,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  Shield,
  HelpCircle,
  Mail,
  Link2,
  Radio,
  Sparkles,
} from 'lucide-react';
import { cn } from '@autodm/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { handleLogout } from '@/lib/auth-helpers';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

const navItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌥D' },
  { name: 'Automations', href: '/automations', icon: MessageSquareCode, shortcut: '⌥A' },
  { name: 'Reply Desk', href: '/reply-desk', icon: Sparkles, shortcut: '⌥R' },
  { name: 'Delivery Logs', href: '/delivery-logs', icon: Radio, shortcut: '⌥W' },
  { name: 'Inbox', href: '/inbox', icon: Inbox, shortcut: '⌥I' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, shortcut: '⌥L' },
  { name: 'Settings', href: '/settings', icon: Settings, shortcut: '⌥S' },
];

const adminNavItem: SidebarItem = { name: 'Admin', href: '/admin', icon: Shield };

interface SidebarProps {
  onOpenHelp: () => void;
  onOpenContact: () => void;
}

export function Sidebar({ onOpenHelp, onOpenContact }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Creator';
  const userRole = session?.user?.role || 'Creator';
  const isAdmin = session?.user?.role === 'ADMIN';
  const allNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;

  React.useEffect(() => {
    const val = localStorage.getItem('sidebar-collapsed') === 'true';
    setCollapsed(val);
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen border-r border-white/5 bg-black/40 backdrop-blur-md sticky top-0 left-0 overflow-hidden select-none transition-[width] duration-200 ease-in-out z-40',
        mounted && collapsed ? 'w-[72px]' : 'w-[240px]',
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-tr from-primary to-accent-cyan shadow-[0_0_15px_rgba(0,187,136,0.3)] flex-shrink-0">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          {(!mounted || !collapsed) && (
            <span className="text-base font-bold bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent truncate transition-opacity duration-200">
              DMPilot
            </span>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-md hover:bg-white/5 border border-transparent hover:border-white/5 text-gray-400 hover:text-white transition-colors"
          aria-label="Toggle Sidebar"
        >
          {mounted && collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {allNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex items-center w-full px-3 py-2.5 rounded-lg text-sm transition-all group relative overflow-hidden',
                isActive
                  ? 'text-primary font-semibold bg-white/5'
                  : 'text-gray-400 hover:text-white hover:bg-white/5',
              )}
            >
              {/* Glow Highlight bar for active route */}
              {isActive && (
                <div className="absolute left-0 w-1 h-5 rounded-r bg-primary shadow-[0_0_8px_#00bb88]" />
              )}

              <item.icon
                className={cn(
                  'h-5 w-5 flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-gray-400 group-hover:text-white',
                )}
              />

              {(!mounted || !collapsed) && (
                <span className="ml-3 flex-1 text-left truncate transition-opacity duration-200">
                  {item.name}
                </span>
              )}

              {(!mounted || !collapsed) && item.shortcut && (
                <kbd className="hidden group-hover:inline-flex items-center text-[9px] font-mono border border-white/10 bg-black/40 px-1 rounded text-gray-500">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          );
        })}
      </nav>

      {/* Help & Contact buttons */}
      <div className="px-3 py-2 space-y-1 border-t border-white/5 flex-shrink-0">
        <button
          onClick={onOpenHelp}
          className={cn(
            'flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer',
            collapsed && 'justify-center px-0',
          )}
          title="Help Guide & Instructions"
        >
          <HelpCircle className="h-4 w-4 flex-shrink-0" />
          {(!mounted || !collapsed) && <span className="ml-3 truncate">Help Guide</span>}
        </button>
        <button
          onClick={onOpenContact}
          className={cn(
            'flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer',
            collapsed && 'justify-center px-0',
          )}
          title="Contact Support"
        >
          <Mail className="h-4 w-4 flex-shrink-0" />
          {(!mounted || !collapsed) && <span className="ml-3 truncate">Contact Support</span>}
        </button>
        <a
          href="https://followeranalyzer.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer',
            collapsed && 'justify-center px-0',
          )}
          title="Instagram Relationship Analyzer"
        >
          <Link2 className="h-4 w-4 flex-shrink-0 text-primary" />
          {(!mounted || !collapsed) && <span className="ml-3 truncate">Follower Analyzer</span>}
        </a>
      </div>

      {/* Footer Profile */}
      <div className="p-4 border-t border-white/5 flex items-center justify-between overflow-hidden flex-shrink-0">
        <div className="flex items-center space-x-3 truncate">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent-emerald flex-shrink-0 shadow-sm flex items-center justify-center text-primary-foreground font-bold text-xs">
            {userName.charAt(0).toUpperCase()}
          </div>
          {(!mounted || !collapsed) && (
            <div className="flex flex-col truncate transition-opacity duration-200">
              <span className="text-sm font-medium text-white truncate">{userName}</span>
              <span className="text-[10px] text-gray-500 truncate capitalize">
                {userRole.toLowerCase()}
              </span>
            </div>
          )}
        </div>
        {(!mounted || !collapsed) && (
          <button
            onClick={() => handleLogout()}
            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
