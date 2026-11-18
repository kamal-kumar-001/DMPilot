'use client';

/**
 * STATIC SAMPLE - admin navigation reorganization proposal.
 * Fake data, no wired actions, no backend calls. Rendered only for review;
 * the real /admin layout is unchanged until this proposal is accepted.
 */
import * as React from 'react';
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
  Menu,
  X,
  BarChart3,
  Megaphone,
  LifeBuoy,
  Radio,
  Mail,
  Gauge,
  MessageSquare,
  Package,
  Settings,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@dmpilot/ui';

// Proposed grouping. Each leaf keeps its current tab id, so existing
// /admin#<tab> deep links keep working after the reorganization.
const GROUPS = [
  {
    id: 'today',
    name: 'Today',
    icon: Gauge,
    items: [
      { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
      { id: 'monitoring', name: 'Monitoring', icon: Activity },
    ],
  },
  {
    id: 'creators',
    name: 'Creators',
    icon: Users,
    items: [
      { id: 'creators', name: 'Creators', icon: Users },
      { id: 'service-access', name: 'Service Access', icon: Users },
      { id: 'delete-requests', name: 'Delete Requests', icon: Trash2 },
    ],
  },
  {
    id: 'automations',
    name: 'Automations & Delivery',
    icon: Layers,
    items: [
      { id: 'campaigns', name: 'Campaigns', icon: Layers },
      { id: 'webhooks', name: 'Webhooks Audit', icon: Radio },
      { id: 'queue', name: 'Job Queue', icon: Server },
    ],
  },
  {
    id: 'revenue',
    name: 'Revenue',
    icon: TrendingUp,
    items: [
      { id: 'plans', name: 'Billing Plans', icon: CreditCard },
      { id: 'promotions', name: 'Promotions', icon: Megaphone },
    ],
  },
  {
    id: 'product',
    name: 'Product Controls',
    icon: Package,
    items: [{ id: 'flags', name: 'Feature Flags', icon: Flag }],
  },
  {
    id: 'communication',
    name: 'Communication',
    icon: MessageSquare,
    items: [
      { id: 'email-automations', name: 'Email Automations', icon: Mail },
      { id: 'support', name: 'Support Tickets', icon: LifeBuoy },
    ],
  },
  {
    id: 'system',
    name: 'System',
    icon: Settings,
    items: [
      { id: 'logs', name: 'Audit Logs', icon: FileText },
      { id: 'app-review', name: 'App Review Mode (guarded)', icon: Shield },
      { id: 'updates', name: 'Update Control (later)', icon: Server },
    ],
  },
] as const;

const FAKE_STATS = [
  { label: 'Active creators (sample)', value: '128' },
  { label: 'DMs sent today (sample)', value: '3,412' },
  { label: 'Failed deliveries (sample)', value: '7' },
  { label: 'Open support tickets (sample)', value: '4' },
];

export default function AdminReorgPreviewClient() {
  const [activeGroup, setActiveGroup] = React.useState<string>('today');
  const [activeItem, setActiveItem] = React.useState<string>('dashboard');
  // Drawer starts open so the mobile layout can be reviewed without tapping.
  const [mobileOpen, setMobileOpen] = React.useState(true);

  const group = GROUPS.find((g) => g.id === activeGroup) ?? GROUPS[0];

  const nav = (
    <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
      {GROUPS.map((g) => {
        const GroupIcon = g.icon;
        const isActiveGroup = g.id === activeGroup;
        return (
          <div key={g.id}>
            <button
              onClick={() => {
                setActiveGroup(g.id);
                setActiveItem(g.items[0].id);
                setMobileOpen(false);
              }}
              className={cn(
                'w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors',
                isActiveGroup ? 'bg-rose-50 text-rose-700' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              <GroupIcon className="h-4 w-4 flex-shrink-0" />
              <span className="text-left leading-snug">{g.name}</span>
              <span className="ml-auto text-[10px] font-semibold text-slate-500">
                {g.items.length}
              </span>
            </button>
            {/* Sample shows every group expanded so placement can be reviewed. */}
            {true && (
              <div className="mt-1 ml-4 pl-3 border-l border-slate-200 space-y-0.5">
                {g.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = item.id === activeItem;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveItem(item.id);
                        setMobileOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors',
                        isActive
                          ? 'bg-rose-100/70 text-rose-800'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                      )}
                    >
                      <ItemIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-left leading-snug">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col h-screen border-r border-slate-200/80 bg-white/85 backdrop-blur-xl sticky top-0 left-0 w-[240px] overflow-hidden select-none flex-shrink-0 z-40 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200/80 flex-shrink-0">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-tr from-rose-600 to-red-500 shadow-sm flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-extrabold text-slate-900 truncate">Admin Portal</span>
          </div>
        </div>
        {nav}
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 z-40 flex items-center px-4 space-x-3">
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="text-sm font-extrabold text-slate-900">Admin Portal (sample)</span>
      </div>
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute left-0 top-14 bottom-0 w-64 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="relative flex-1 overflow-y-auto p-4 md:p-8 pt-18 md:pt-8 mt-14 md:mt-0">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-xl border-2 border-amber-400 bg-amber-100 px-4 py-3 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm font-medium text-slate-900">
              <span className="font-bold">Static reorganization sample.</span> Fake data, no wired
              actions. Grouping proposal only - the live admin is unchanged. Existing tab ids (deep
              links like <code>/admin#campaigns</code>) are preserved inside each group.
            </div>
          </div>

          <div className="flex justify-between items-center pb-4 border-b border-slate-200/80">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {group.name}
              </h1>
              <p className="text-sm font-medium text-slate-700">
                Sample content for the “{group.items.find((i) => i.id === activeItem)?.name}”
                section.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FAKE_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 p-5 shadow-sm"
              >
                <p className="text-xs text-slate-600 font-semibold">{s.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-2">What changes here</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              The 14 current flat sidebar tabs are grouped into 7 sections. No tab is renamed or
              removed; “App Review Mode” (guarded) and “Update Control” (later) are the only new
              entries, both under System. Clicking a group reveals its existing tabs.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
