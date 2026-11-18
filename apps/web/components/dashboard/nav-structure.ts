import {
  LayoutDashboard,
  MessageSquareCode,
  Inbox,
  Settings,
  BarChart3,
  Radio,
  Sparkles,
  Send,
  Megaphone,
} from 'lucide-react';

export interface NavLeaf {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

export interface NavGroup {
  /** Group label rendered above its always-visible sublinks. */
  group: string;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return (entry as NavGroup).items !== undefined;
}

/**
 * Creator navigation: top-level entries plus groups whose sublinks are always
 * visible (no accordion). Route paths are unchanged from the flat nav.
 */
export const NAV_STRUCTURE: NavEntry[] = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌥D' },
  { name: 'Automations', href: '/automations', icon: MessageSquareCode, shortcut: '⌥A' },
  {
    group: 'Conversations',
    items: [
      { name: 'Inbox', href: '/inbox', icon: Inbox, shortcut: '⌥I' },
      { name: 'Comment replies', href: '/reply-desk', icon: Sparkles, shortcut: '⌥R' },
    ],
  },
  {
    group: 'Results',
    items: [
      { name: 'Overview', href: '/analytics', icon: BarChart3, shortcut: '⌥L' },
      { name: 'Delivery log', href: '/delivery-logs', icon: Radio, shortcut: '⌥W' },
    ],
  },
  {
    group: 'Studio',
    items: [
      { name: 'Publish', href: '/publish', icon: Send, shortcut: '⌥P' },
      { name: 'Ads', href: '/ads', icon: Megaphone, shortcut: '⌥G' },
    ],
  },
  { name: 'Settings', href: '/settings', icon: Settings, shortcut: '⌥S' },
];

/** Flat list of every leaf, for consumers that iterate (mobile menu, hotkeys). */
export const NAV_LEAVES: NavLeaf[] = NAV_STRUCTURE.flatMap((entry) =>
  isNavGroup(entry) ? entry.items : [entry],
);
