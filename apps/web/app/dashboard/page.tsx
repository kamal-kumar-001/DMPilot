'use client';

import * as React from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { AnalyticsChart } from '@/components/dashboard/analytics-chart';
import { FollowersChart } from '@/components/dashboard/followers-chart';
import { CampaignsList } from '@/components/dashboard/campaigns-list';
import { ConnectedAccounts } from '@/components/dashboard/connected-accounts';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { EmptyState } from '@/components/dashboard/empty-state';
import { CampaignWizard } from '@/components/dashboard/campaign-wizard';
import { CampaignDetailsModal } from '@/components/dashboard/campaign-details';
import { SurgeAlertBanner } from '@/components/dashboard/surge-alert-banner';
import { Button, toast } from '@autodm/ui';
import { UserPlus, FolderPlus, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

export default function DashboardPage() {
  const [accounts, setAccounts] = React.useState<unknown[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [editingCampaignId, setEditingCampaignId] = React.useState<string | null>(null);
  const [viewCampaignId, setViewCampaignId] = React.useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [campaignsRefreshKey, setCampaignsRefreshKey] = React.useState(0);

  const fetchAccounts = async () => {
    try {
      const tokenRes = await fetch('/api/auth/session');
      const session = await tokenRes.json();
      const jwt = (session as { accessToken?: string })?.accessToken;

      const data = await apiRequest<unknown[]>('/instagram', {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });
      setAccounts(data || []);
    } catch (error) {
      console.error('Failed to check connected accounts status', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAccounts();

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

  const handleConnectAccount = async () => {
    const toastId = toast.loading('Connecting Instagram...', {
      description: 'Requesting Meta authentication gateway...',
    });
    try {
      const tokenRes = await fetch('/api/auth/session');
      const session = await tokenRes.json();
      const jwt = (session as { accessToken?: string })?.accessToken;

      const data = await apiRequest<{ url: string }>('/instagram/connect', {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });

      if (data?.url) {
        toast.success('Redirecting to Meta...', { id: toastId });
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Action Header bar */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Dashboard</h1>
            <p className="text-xs text-gray-500">
              Overview of your Meta message automation funnels
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={handleCreateCampaign}
              size="sm"
              className="text-xs font-bold gap-2 h-9 bg-gradient-to-r from-primary to-accent-cyan hover:opacity-90 transition-all shadow-[0_0_15px_rgba(0,187,136,0.3)] text-primary-foreground border-0 cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
              <span>New Campaign</span>
            </Button>

            <Button
              onClick={handleConnectAccount}
              size="sm"
              className="text-xs font-bold gap-2 h-9 bg-gradient-to-r from-[#1D4ED8] to-[#1E3A8A] hover:opacity-90 transition-all text-white border-0 shadow-[0_0_15px_rgba(29,78,216,0.2)] cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Connect IG</span>
            </Button>
          </div>
        </div>

        {/* Dashboard Viewport */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-gray-400">Loading your creator dashboard...</p>
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState onConnect={handleConnectAccount} onCreateCampaign={handleCreateCampaign} />
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Surge Spike Alert Banner */}
            <SurgeAlertBanner
              onRefreshCampaigns={() => setCampaignsRefreshKey((prev) => prev + 1)}
            />

            {/* Stats Row */}
            <StatsGrid />

            {/* Grid charts and lists */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Line Charts & Campaign list */}
              <div className="lg:col-span-2 space-y-6">
                <AnalyticsChart />
                <FollowersChart />
                <CampaignsList
                  key={campaignsRefreshKey}
                  onEditCampaign={handleEditCampaign}
                  onViewCampaign={(id) => {
                    setViewCampaignId(id);
                    setIsDetailsOpen(true);
                  }}
                />
              </div>

              {/* Right Column: Channels & Activity feeds */}
              <div className="space-y-6 flex flex-col justify-between">
                <ConnectedAccounts />
                <RecentActivity />
              </div>
            </div>
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
        onArchive={async (id) => {
          const toastId = toast.loading('Archiving campaign...');
          try {
            await apiRequest(`/campaigns/${id}`, { method: 'DELETE' });
            toast.success('Campaign archived successfully', { id: toastId });
            setIsDetailsOpen(false);
            setViewCampaignId(null);
            setCampaignsRefreshKey((prev) => prev + 1);
          } catch (error) {
            toast.error('Failed to archive campaign', { id: toastId });
          }
        }}
      />
    </DashboardLayout>
  );
}
