'use client';

import * as React from 'react';
import { useFeatureAccess } from '@/lib/use-feature-access';
import { Lock } from 'lucide-react';
import { FeatureGate } from '@/components/dashboard/feature-gate';
import { CampaignsList } from '@/components/dashboard/campaigns-list';
import { AccountChips } from '@/components/dashboard/account-chips';
import { PeriodPicker, type PeriodDays } from '@/components/dashboard/home/period-picker';
import { HomeStats } from '@/components/dashboard/home/home-stats';
import { DmAttemptsChart } from '@/components/dashboard/home/dm-attempts-chart';
import { NeedsAttention } from '@/components/dashboard/home/needs-attention';
import { NeedsReply } from '@/components/dashboard/home/needs-reply';
import { GrowthStrip } from '@/components/dashboard/home/growth-strip';
import { useAccountFilter } from '@/lib/account-filter';
import { useSession } from 'next-auth/react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { CampaignWizard } from '@/components/dashboard/campaign-wizard';
import { CampaignDetailsModal } from '@/components/dashboard/campaign-details';
import { Button, toast } from '@dmpilot/ui';
import { UserPlus, FolderPlus, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { useCreatorQuery } from '@/lib/use-creator-query';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const access = useFeatureAccess();
  const { data: session } = useSession();
  const { accounts: filterAccounts, selectedAccountId } = useAccountFilter();
  const [period, setPeriod] = React.useState<PeriodDays>(7);
  const {
    data: accounts = [],
    loading,
    error,
    refetch: fetchAccounts,
  } = useCreatorQuery<unknown[]>('/instagram');
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [editingCampaignId, setEditingCampaignId] = React.useState<string | null>(null);
  const [viewCampaignId, setViewCampaignId] = React.useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [campaignsRefreshKey, setCampaignsRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'instagram_connected') {
        toast.success('Instagram account connected successfully!');
        window.history.replaceState({}, '', '/dashboard');
      } else if (params.get('error')) {
        const errorMsg = params.get('error');
        toast.error('Connection Failed', {
          description: errorMsg ? decodeURIComponent(errorMsg) : 'Could not link account',
        });
        window.history.replaceState({}, '', '/dashboard');
      }
    }
  }, []);

  const handleConnectAccount = async (type: 'instagram' | 'facebook' = 'instagram') => {
    if (accounts.length > 0 && !access.check('MULTI_ACCOUNT', 'Additional Instagram accounts'))
      return;
    const toastId = toast.loading('Connecting...');
    try {
      const data = await apiRequest<{ url: string }>(`/instagram/connect?type=${type}`);

      if (data?.url) {
        toast.success('Redirecting...', { id: toastId });
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL returned');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to initiate connection';
      toast.error('Connection Failed', {
        id: toastId,
        description: errMsg,
      });
    }
  };

  const handleCreateCampaign = () => {
    if (loading || error) {
      toast.error('Wait for your channels to load, or refresh if loading failed.');
      return;
    }
    if (accounts.length === 0) {
      toast.error('Connect your Instagram channel first before creating campaigns.');
      return;
    }
    setEditingCampaignId(null);
    setIsWizardOpen(true);
  };

  const handleEditCampaign = (id: string) => {
    setEditingCampaignId(id);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setEditingCampaignId(null);
  };

  const handleWizardSuccess = () => {
    fetchAccounts();
    setCampaignsRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Top Action Header bar */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {greeting()}, {session?.user?.name || session?.user?.email?.split('@')[0] || 'there'}
            </h1>
            <p className="text-xs text-slate-600">
              {selectedAccountId
                ? `@${filterAccounts.find((a) => a.id === selectedAccountId)?.username ?? ''} · `
                : 'All accounts · '}
              last {period} days
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            <Button
              onClick={handleCreateCampaign}
              size="sm"
              className="text-xs font-bold gap-2 h-9 bg-gradient-to-r from-primary to-accent-cyan hover:opacity-90 transition-all shadow-[0_0_15px_rgba(0,187,136,0.3)] text-primary-foreground border-0 cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
              <span>New automation</span>
            </Button>

            <Button
              onClick={() => handleConnectAccount('instagram')}
              size="sm"
              className="text-xs font-bold gap-2 h-9 bg-gradient-to-r from-[#1D4ED8] to-[#1E3A8A] hover:opacity-90 transition-all text-white border-0 shadow-[0_0_15px_rgba(29,78,216,0.2)] cursor-pointer"
            >
              {/* Lock icon only once the check resolves to denied (no pending
                  jitter); handleConnectAccount still gates via access.check. */}
              {accounts.length > 0 && access.denied('MULTI_ACCOUNT') ? (
                <Lock className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>Connect IG</span>
            </Button>
          </div>
        </div>

        {/* Dashboard Viewport */}
        {!loading && !error && accounts.length === 0 ? (
          <EmptyState
            onConnect={() => handleConnectAccount('instagram')}
            onCreateCampaign={handleCreateCampaign}
          />
        ) : (
          <div className="space-y-6" aria-busy={loading}>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                Could not load channels. Please refresh to try again.
              </p>
            )}
            {/* Account picker: All accounts by default, one chip per account */}
            <AccountChips />

            {/* Only renders when something actually needs action */}
            <NeedsAttention />

            {/* DM-first numbers with real deltas vs the previous period */}
            <HomeStats period={period} />

            {/* Automations + future reply queue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <CampaignsList
                  key={campaignsRefreshKey}
                  onEditCampaign={handleEditCampaign}
                  onViewCampaign={(id) => {
                    setViewCampaignId(id);
                    setIsDetailsOpen(true);
                  }}
                />
              </div>
              <div className="space-y-6">
                <NeedsReply />
              </div>
            </div>

            <FeatureGate feature="ANALYTICS_ADVANCED" label="DM attempts chart">
              <DmAttemptsChart period={period} />
            </FeatureGate>

            <GrowthStrip />
          </div>
        )}
      </div>

      {/* Campaign Creation Wizard */}
      <CampaignWizard
        isOpen={isWizardOpen}
        onClose={handleCloseWizard}
        onSuccess={handleWizardSuccess}
        editCampaignId={editingCampaignId}
      />

      {/* Campaign Details View Modal */}
      <CampaignDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setViewCampaignId(null);
          setCampaignsRefreshKey((prev) => prev + 1);
        }}
        campaignId={viewCampaignId}
        onEdit={handleEditCampaign}
        onStatusToggle={async (id, currentStatus, name) => {
          const toastId = toast.loading(`Updating status for ${name}...`);
          try {
            await apiRequest(`/campaigns/${id}/status`, {
              method: 'PATCH',
            });
            toast.success(`Campaign successfully updated`, { id: toastId });
            setCampaignsRefreshKey((prev) => prev + 1);
          } catch (error) {
            toast.error('Failed to update status', { id: toastId });
          }
        }}
        onArchive={async (id, name) => {
          const toastId = toast.loading(`Archiving '${name || 'campaign'}'...`);
          try {
            await apiRequest(`/campaigns/${id}/archive`, { method: 'POST' });
            toast.success(`'${name || 'Campaign'}' archived successfully`, {
              id: toastId,
              description: 'You can restore archived campaigns from Settings.',
            });
            setIsDetailsOpen(false);
            setViewCampaignId(null);
            setCampaignsRefreshKey((prev) => prev + 1);
          } catch (error) {
            toast.error('Failed to archive campaign', { id: toastId });
          }
        }}
        onDelete={async (id, name) => {
          const toastId = toast.loading(`Moving '${name || 'campaign'}' to trash...`);
          try {
            await apiRequest(`/campaigns/${id}`, { method: 'DELETE' });
            toast.success(`'${name || 'Campaign'}' moved to trash`, {
              id: toastId,
              description: 'You can restore or permanently delete it from Settings.',
            });
            setIsDetailsOpen(false);
            setViewCampaignId(null);
            setCampaignsRefreshKey((prev) => prev + 1);
          } catch (error) {
            toast.error('Failed to delete campaign', { id: toastId });
          }
        }}
      />
    </>
  );
}
