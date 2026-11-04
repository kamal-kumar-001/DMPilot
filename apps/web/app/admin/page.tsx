'use client';
import Loading from '@/app/loading';
import { AdminServiceAccess } from '@/components/admin/admin-service-access';
import { AdminEmailAutomations } from '@/components/admin/admin-email-automations';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import { toast } from '@dmpilot/ui';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminStatsDashboard } from '@/components/admin/admin-stats-dashboard';
import { AdminCreators } from '@/components/admin/admin-creators';
import { AdminCampaigns } from '@/components/admin/admin-campaigns';
import { AdminDeleteRequests } from '@/components/admin/admin-delete-requests';
import { AdminPlans } from '@/components/admin/admin-plans';
import { AdminLogs } from '@/components/admin/admin-logs';
import { AdminQueue } from '@/components/admin/admin-queue';
import { AdminFeatureFlags } from '@/components/admin/admin-feature-flags';
import { AdminMonitoring } from '@/components/admin/admin-monitoring';
import { AdminPromotions } from '@/components/admin/admin-promotions';
import { AdminSupport } from '@/components/admin/admin-support';
import { WebhookLogs } from '@/components/monitoring/webhook-logs';
import {
  Users,
  Layers,
  Trash2,
  CreditCard,
  FileText,
  Server,
  Flag,
  Activity,
  BarChart3,
  Megaphone,
  LifeBuoy,
  Radio,
  Mail,
} from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'creators', label: 'Creators', icon: Users },
  { id: 'campaigns', label: 'Campaigns', icon: Layers },
  { id: 'webhooks', label: 'Webhooks Audit', icon: Radio },
  { id: 'delete-requests', label: 'Delete Requests', icon: Trash2 },
  { id: 'plans', label: 'Billing Plans', icon: CreditCard },
  { id: 'logs', label: 'Audit Logs', icon: FileText },
  { id: 'queue', label: 'Queue', icon: Server },
  { id: 'flags', label: 'Feature Flags', icon: Flag },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'promotions', label: 'Promotions', icon: Megaphone },
  { id: 'service-access', label: 'Service Access', icon: Users },
  { id: 'email-automations', label: 'Email Automations', icon: Mail },
  { id: 'support', label: 'Support Tickets', icon: LifeBuoy },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTabState] = React.useState<TabId | null>(null);
  React.useEffect(() => {
    const restore = () => {
      const id = window.location.hash.slice(1);
      setTabState(TABS.some((item) => item.id === id) ? (id as TabId) : 'dashboard');
    };
    restore();
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
    };
  }, []);
  const setTab = (id: string) => {
    const next = TABS.some((item) => item.id === id) ? (id as TabId) : 'dashboard';
    if (window.location.hash !== `#${next}`)
      window.history.pushState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#${next}`,
      );
    setTabState(next);
  };

  // Client-side role guard
  React.useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [status, session, router]);

  if (status === 'loading') return <Loading />;

  if (session?.user?.role !== 'ADMIN') return null;

  return (
    <AdminLayout activeTab={tab ?? 'dashboard'} setActiveTab={setTab}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200/80">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight capitalize">
              {tab ? (TABS.find((item) => item.id === tab)?.label ?? 'Dashboard') : 'Admin'}
            </h1>
            <p className="text-xs text-slate-500">
              Manage {tab ? (TABS.find((item) => item.id === tab)?.label ?? 'Dashboard') : 'Admin'}{' '}
              settings and configuration.
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {!tab && <Loading />}
          {tab === 'dashboard' && <AdminStatsDashboard />}
          {tab === 'creators' && <AdminCreators />}
          {tab === 'campaigns' && <AdminCampaigns />}
          {tab === 'webhooks' && <WebhookLogs />}
          {tab === 'delete-requests' && <AdminDeleteRequests />}
          {tab === 'plans' && <AdminPlans />}
          {tab === 'logs' && <AdminLogs />}
          {tab === 'queue' && <AdminQueue />}
          {tab === 'flags' && <AdminFeatureFlags />}
          {tab === 'monitoring' && <AdminMonitoring />}
          {tab === 'promotions' && <AdminPromotions />}
          {tab === 'service-access' && <AdminServiceAccess />}
          {tab === 'email-automations' && <AdminEmailAutomations />}
          {tab === 'support' && <AdminSupport />}
        </div>
      </div>
    </AdminLayout>
  );
}
