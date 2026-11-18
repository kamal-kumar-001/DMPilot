'use client';

import * as React from 'react';
import { LayoutDashboard, MessageSquareCode, Inbox, BarChart3, Menu, Lock } from 'lucide-react';
import { cn } from '@dmpilot/ui';
import { ROUTE_FEATURES, useFeatureAccess } from '@/lib/use-feature-access';

interface BottomBarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BOTTOM_BAR_ITEMS: BottomBarItem[] = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Automations', href: '/automations', icon: MessageSquareCode },
  { name: 'Chats', href: '/inbox', icon: Inbox },
  { name: 'Results', href: '/analytics', icon: BarChart3 },
];

/**
 * Phone navigation: the four daily destinations plus More, which opens the
 * full mobile menu. Same entitlement gating as the sidebar.
 */
export function BottomBar({
  activePath,
  onNavigate,
  onOpenMore,
}: {
  activePath?: string;
  onNavigate: (href: string) => void;
  onOpenMore: () => void;
}) {
  const access = useFeatureAccess();

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {BOTTOM_BAR_ITEMS.map((item) => {
          const gate = ROUTE_FEATURES[item.href];
          const locked = gate && access.denied(gate.key);
          const isActive = activePath === item.href;
          return (
            <button
              key={item.href}
              type="button"
              aria-label={locked ? `${item.name} locked` : item.name}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.href)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors cursor-pointer relative',
                isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900',
              )}
            >
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 rounded-b bg-primary shadow-[0_0_8px_#00bb88]" />
              )}
              <item.icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-slate-400')} />
              <span>{item.name}</span>
              {locked && <Lock className="absolute top-1.5 right-3 h-2.5 w-2.5 text-slate-400" />}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="More"
          onClick={onOpenMore}
          className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Menu className="h-5 w-5 text-slate-400" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
