'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '../../components/dashboard/layout';
import { CampaignWizard } from '../../components/dashboard/campaign-wizard';
import { CampaignDetailsModal } from '../../components/dashboard/campaign-details';
import { UpgradeModal } from '../../components/automations/upgrade-modal';
import { Button, Input, toast } from '@autodm/ui';
import {
  Play,
  Pause,
  Copy,
  Trash2,
  Archive,
  Plus,
  Search,
  Sparkles,
  Calendar,
  AlertCircle,
  Loader2,
  Edit,
  MoreVertical,
  Zap,
} from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { ConfirmationModal } from '../../components/ui/confirmation-modal';

interface Campaign {
  id: string;
  name: string;
  type?: string;
  triggerType?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  keywords?: Array<{ keyword: string; matchType: string }>;
  dmTemplate?: string;
  dmVariants?: string[];
  followCheckGate?: boolean;
  instagramAccount?: {
    username: string;
    displayName: string | null;
  };
  metrics?: {
    totalComments: number;
    totalDmsSent: number;
    failedDms: number;
    successRate: number;
  };
}

export default function AutomationsPage() {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('ALL');
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = React.useState(false);
  const [editingCampaignId, setEditingCampaignId] = React.useState<string | null>(null);
  const [viewCampaignId, setViewCampaignId] = React.useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [planLimits, setPlanLimits] = React.useState<{ max_campaigns: number }>({
    max_campaigns: -1,
  });

  const fetchCampaigns = async () => {
    try {
      const [data, limitsData] = await Promise.all([
        apiRequest<Campaign[]>('/campaigns'),
        apiRequest<{ limits: { max_campaigns: number } }>('/billing/limits').catch(() => null),
      ]);
      setCampaigns(data || []);
      if (limitsData?.limits) {
        setPlanLimits(limitsData.limits);
      }
    } catch (error) {
      console.error('Failed to load campaigns list', error);
      toast.error('Failed to load campaigns list');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreateCampaign = () => {
    const maxCampaigns = planLimits.max_campaigns;
    const activeCount = campaigns.filter((c) => c.status !== 'DELETED').length;

    // Upfront UX Gating Check: If plan limit is reached (and not unlimited -1), show UpgradeModal immediately!
    if (maxCampaigns !== -1 && maxCampaigns > 0 && activeCount >= maxCampaigns) {
      setIsUpgradeModalOpen(true);
      toast.error(
        `Campaign limit reached (${activeCount}/${maxCampaigns}). Upgrade to Pro for unlimited campaigns!`,
      );
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

  const handleViewDetails = (id: string) => {
    setViewCampaignId(id);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setViewCampaignId(null);
    fetchCampaigns(); // refresh list in case they toggled status or archived from the details view
  };

  // KPI calculations
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE').length;
  const pausedCampaigns = campaigns.filter((c) => c.status === 'PAUSED').length;

  const handleToggleStatus = async (id: string, currentStatus: string, name: string) => {
    const toastId = toast.loading(`Updating status for '${name}'...`);
    try {
      await apiRequest(`/campaigns/${id}/status`, {
        method: 'PATCH',
      });

      const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c)));
      toast.success(`Campaign ${nextStatus === 'ACTIVE' ? 'activated' : 'paused'} successfully`, {
        id: toastId,
      });
    } catch (error) {
      toast.error(`Failed to update campaign status`, { id: toastId });
    }
  };

  const handleDuplicate = async (id: string, name: string) => {
    const toastId = toast.loading(`Duplicating campaign '${name}'...`);
    try {
      const newCampaign = await apiRequest<Campaign>(`/campaigns/${id}/duplicate`, {
        method: 'POST',
      });

      setCampaigns((prev) => [newCampaign, ...prev]);
      toast.success('Campaign duplicated successfully', {
        id: toastId,
        description: 'Cloned campaign is paused by default for your review.',
      });
    } catch (error) {
      toast.error('Failed to duplicate campaign', { id: toastId });
    }
  };

  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    action: 'archive' | 'delete';
    id: string;
    name: string;
  }>({
    isOpen: false,
    action: 'archive',
    id: '',
    name: '',
  });
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  const handleArchive = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      action: 'archive',
      id,
      name,
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      action: 'delete',
      id,
      name,
    });
  };

  const handleConfirmAction = async () => {
    const { action, id, name } = confirmModal;
    if (!id) return;
    setConfirmLoading(true);
    const toastId = toast.loading(
      action === 'archive' ? `Archiving '${name}'...` : `Moving '${name}' to trash...`,
    );
    try {
      if (action === 'archive') {
        await apiRequest(`/campaigns/${id}/archive`, {
          method: 'POST',
        });
        toast.success(`Archived campaign '${name}'`, {
          id: toastId,
          description: 'You can restore archived campaigns from settings.',
        });
      } else {
        await apiRequest(`/campaigns/${id}`, {
          method: 'DELETE',
        });
        toast.success(`Moved '${name}' to trash`, {
          id: toastId,
          description: 'You can restore or permanently delete it from settings.',
        });
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } catch (error) {
      toast.error(
        action === 'archive' ? 'Failed to archive campaign' : 'Failed to delete campaign',
        {
          id: toastId,
        },
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const campaignType = c.type || c.triggerType || 'COMMENT_TO_DM';
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaignType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' ? true : campaignType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getCampaignBadgeColor = (type: string) => {
    switch (type) {
      case 'COMMENT_TO_DM':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'COMMENT_REPLY':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'KEYWORD_TO_DM':
        return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20';
      case 'STORY_REPLY_TO_DM':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'SHARE_TO_DM':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Campaign Builder
            </h1>
            <p className="text-xs text-slate-600">
              Construct message triggers, reply links, and launch DMs
            </p>
          </div>

          <Button
            onClick={handleCreateCampaign}
            size="sm"
            className="text-xs font-bold gap-2 h-9 self-start bg-gradient-to-r from-primary to-accent-cyan hover:opacity-90 transition-all shadow-[0_0_15px_rgba(0,187,136,0.3)] text-primary-foreground border-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </Button>
        </div>

        {/* Stats Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Total Campaigns',
              val: loading ? '...' : totalCampaigns,
              color: 'text-slate-900',
            },
            {
              label: 'Active Automations',
              val: loading ? '...' : activeCampaigns,
              color: 'text-emerald-600',
            },
            {
              label: 'Paused Review',
              val: loading ? '...' : pausedCampaigns,
              color: 'text-slate-500',
            },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-sm"
            >
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <span className={`text-2xl font-extrabold ${card.color}`}>{card.val}</span>
            </div>
          ))}
        </div>

        {/* Filters and search list */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search campaigns by name or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center space-x-1 overflow-x-auto bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
              {[
                { id: 'ALL', label: 'All Formats' },
                { id: 'COMMENT_TO_DM', label: 'Comment to DM' },
                { id: 'SHARE_TO_DM', label: 'Share to DM' },
                { id: 'KEYWORD_TO_DM', label: 'DM Auto Reply' },
                { id: 'WELCOME_DM', label: 'Welcome DM' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTypeFilter(f.id)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    typeFilter === f.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campaigns lists */}
          <div className="space-y-3 flex flex-col justify-start pt-1 min-h-[150px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <p className="text-xs text-gray-500">Loading your automations...</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredCampaigns.length > 0 ? (
                  filteredCampaigns.map((campaign) => (
                    <motion.div
                      key={campaign.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleViewDetails(campaign.id)}
                      className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    >
                      {/* Campaign core info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center space-x-2.5">
                          <h3
                            className="text-sm font-extrabold text-slate-900 truncate max-w-[250px]"
                            title={campaign.name}
                          >
                            {campaign.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider ${getCampaignBadgeColor(campaign.type || campaign.triggerType || 'COMMENT_TO_DM')}`}
                          >
                            {(campaign.type || campaign.triggerType || 'COMMENT_TO_DM').replace(
                              /_/g,
                              ' ',
                            )}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-bold ${
                              campaign.status === 'ACTIVE'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            {campaign.status.toLowerCase()}
                          </span>
                        </div>

                        {/* Timeline dates and descriptors */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                          </span>

                          <span className="flex items-center space-x-1">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              Channel:{' '}
                              <strong className="text-slate-900">
                                @{campaign.instagramAccount?.username || 'linked'}
                              </strong>
                            </span>
                          </span>
                        </div>

                        {/* Campaign mini performance metrics */}
                        {campaign.metrics && (
                          <div className="grid grid-cols-3 gap-2 pt-2 max-w-sm">
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 flex flex-col justify-start">
                              <span className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">
                                Comments
                              </span>
                              <span className="text-[10px] font-bold text-slate-900 mt-0.5">
                                {campaign.metrics.totalComments}
                              </span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 flex flex-col justify-start">
                              <span className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">
                                DMs Sent
                              </span>
                              <span className="text-[10px] font-bold text-slate-900 mt-0.5">
                                {campaign.metrics.totalDmsSent}
                              </span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 flex flex-col justify-start">
                              <span className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">
                                Success
                              </span>
                              <span className="text-[10px] font-extrabold text-emerald-600 mt-0.5">
                                {campaign.metrics.successRate}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Operational trigger buttons */}
                      <div className="flex items-center space-x-2 self-end md:self-auto">
                        {/* Play/Pause */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(campaign.id, campaign.status, campaign.name);
                          }}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            campaign.status === 'ACTIVE'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                              : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                          }`}
                          title={
                            campaign.status === 'ACTIVE' ? 'Pause campaign' : 'Resume campaign'
                          }
                        >
                          {campaign.status === 'ACTIVE' ? (
                            <Pause className="h-4 w-4 fill-current" />
                          ) : (
                            <Play className="h-4 w-4 fill-current" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCampaign(campaign.id);
                          }}
                          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
                          title="Edit Campaign"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(campaign.id, campaign.name);
                          }}
                          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
                          title="Duplicate Campaign"
                        >
                          <Copy className="h-4 w-4" />
                        </button>

                        {/* Archive */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(campaign.id, campaign.name);
                          }}
                          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-amber-700 hover:border-amber-200 hover:bg-amber-50 transition-all cursor-pointer shadow-2xs"
                          title="Archive Campaign"
                        >
                          <Archive className="h-4 w-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(campaign.id, campaign.name);
                          }}
                          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all cursor-pointer shadow-2xs"
                          title="Delete Campaign"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 w-full">
                    <AlertCircle className="h-10 w-10 text-slate-400 animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900">No Automations Configured</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Create your first message trigger funnel flow using our step-by-step
                        Campaign Builder wizard.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleCreateCampaign}
                      className="text-xs font-bold h-9 bg-gradient-to-r from-primary to-accent-cyan hover:opacity-90 transition-all shadow-[0_0_15px_rgba(0,187,136,0.3)] text-primary-foreground border-0 cursor-pointer"
                    >
                      Create Campaign
                    </Button>
                  </div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Builder Multi-Step Wizard Modal */}
      <CampaignWizard
        isOpen={isWizardOpen}
        onClose={handleCloseWizard}
        onSuccess={fetchCampaigns}
        editCampaignId={editingCampaignId}
      />

      {/* Campaign Details View Modal */}
      <CampaignDetailsModal
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
        campaignId={viewCampaignId}
        onEdit={handleEditCampaign}
        onStatusToggle={handleToggleStatus}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      {/* Upfront Upgrade Plan Gating Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Campaign Limit Reached"
        description={`Your current plan allows up to ${planLimits.max_campaigns} active campaigns. Upgrade to Pro for unlimited campaigns and full scale!`}
        currentCount={campaigns.filter((c) => c.status !== 'DELETED').length}
        maxLimit={planLimits.max_campaigns}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        loading={confirmLoading}
        title={confirmModal.action === 'archive' ? 'Archive Campaign' : 'Move Campaign to Trash'}
        description={
          confirmModal.action === 'archive'
            ? `Are you sure you want to archive '${confirmModal.name}'? The automation will be paused and stored in your Archive. You can restore it anytime in Settings.`
            : `Are you sure you want to delete '${confirmModal.name}'? It will be moved to Trash. You can restore or permanently delete it in Settings.`
        }
        confirmText={confirmModal.action === 'archive' ? 'Archive Campaign' : 'Move to Trash'}
        variant={confirmModal.action === 'archive' ? 'warning' : 'danger'}
      />
    </DashboardLayout>
  );
}
