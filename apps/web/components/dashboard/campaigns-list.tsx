'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Layers,
  Play,
  Pause,
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { Input, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface Campaign {
  id: string;
  name: string;
  type:
    | 'COMMENT_TO_DM'
    | 'KEYWORD_TO_DM'
    | 'WELCOME_DM'
    | 'STORY_REPLY_TO_DM'
    | 'COMMENT_REPLY'
    | 'SHARE_TO_DM';
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  createdAt: string;
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

export function CampaignsList({
  onEditCampaign,
  onViewCampaign,
}: {
  onEditCampaign?: (id: string) => void;
  onViewCampaign?: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewCampaignId, setViewCampaignId] = React.useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

  const handleViewDetails = (id: string) => {
    if (onViewCampaign) {
      onViewCampaign(id);
    } else {
      setViewCampaignId(id);
      setIsDetailsOpen(true);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setViewCampaignId(null);
    fetchCampaigns();
  };

  const fetchCampaigns = async () => {
    try {
      const data = await apiRequest<Campaign[]>('/campaigns');
      setCampaigns(data || []);
    } catch (error) {
      console.error('Failed to load campaigns', error);
      toast.error('Failed to load active campaigns');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCampaigns();
  }, []);

  const toggleCampaignStatus = async (id: string, currentStatus: string, name: string) => {
    const toastId = toast.loading(`Updating status for ${name}...`);
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
        toast.success(`Archived '${name}'`, {
          id: toastId,
          description: 'You can restore archived campaigns from Settings.',
        });
      } else {
        await apiRequest(`/campaigns/${id}`, {
          method: 'DELETE',
        });
        toast.success(`Moved '${name}' to trash`, {
          id: toastId,
          description: 'You can restore or permanently delete it from Settings.',
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
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' ? true : c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getCampaignBadgeColor = (type: string) => {
    switch (type) {
      case 'COMMENT_TO_DM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMMENT_REPLY':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'KEYWORD_TO_DM':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'STORY_REPLY_TO_DM':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'SHARE_TO_DM':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">Active Automations</h3>
        </div>

        {/* Filters & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                  statusFilter === f
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchCampaigns()}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer shadow-2xs"
            title="Refresh active automations"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 text-xs h-9 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {/* Campaign List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px] custom-scrollbar flex flex-col justify-start pt-1 font-sans">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-[10px] text-slate-500">Loading campaigns...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredCampaigns.length > 0 ? (
              <div className="space-y-3 w-full self-start">
                {filteredCampaigns.map((campaign) => (
                  <motion.div
                    key={campaign.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleViewDetails(campaign.id)}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all flex items-center justify-between gap-4 cursor-pointer shadow-2xs"
                  >
                    {/* Info block */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span
                          className="text-xs font-bold text-slate-900 truncate max-w-[150px]"
                          title={campaign.name}
                        >
                          {campaign.name}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] font-semibold ${getCampaignBadgeColor(campaign.type)}`}
                        >
                          {campaign.type.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Info sub-metrics */}
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span className="truncate">
                          Channel:{' '}
                          <strong className="text-slate-900 font-semibold">
                            @{campaign.instagramAccount?.username || 'linked'}
                          </strong>
                        </span>
                        <span className="flex items-center space-x-0.5 text-[9px] text-slate-400">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Campaign mini performance metrics */}
                      {campaign.metrics && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="bg-white border border-slate-200/70 rounded-lg px-2 py-1 flex flex-col justify-start">
                            <span className="text-[7px] text-slate-400 uppercase font-bold tracking-wider">
                              Comments
                            </span>
                            <span className="text-[10px] font-bold text-slate-900 mt-0.5">
                              {campaign.metrics.totalComments}
                            </span>
                          </div>
                          <div className="bg-white border border-slate-200/70 rounded-lg px-2 py-1 flex flex-col justify-start">
                            <span className="text-[7px] text-slate-400 uppercase font-bold tracking-wider">
                              DMs Sent
                            </span>
                            <span className="text-[10px] font-bold text-slate-900 mt-0.5">
                              {campaign.metrics.totalDmsSent}
                            </span>
                          </div>
                          <div className="bg-white border border-slate-200/70 rounded-lg px-2 py-1 flex flex-col justify-start">
                            <span className="text-[7px] text-slate-400 uppercase font-bold tracking-wider">
                              Success
                            </span>
                            <span className="text-[10px] font-extrabold text-emerald-600 mt-0.5">
                              {campaign.metrics.successRate}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions toggles */}
                    <div className="flex items-center space-x-1.5 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCampaignStatus(campaign.id, campaign.status, campaign.name);
                        }}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          campaign.status === 'ACTIVE'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                        title={
                          campaign.status === 'ACTIVE' ? 'Pause Campaign' : 'Activate Campaign'
                        }
                      >
                        {campaign.status === 'ACTIVE' ? (
                          <Pause className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCampaign?.(campaign.id);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
                        title="Edit Campaign"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>

                      {/* Archive */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            isOpen: true,
                            action: 'archive',
                            id: campaign.id,
                            name: campaign.name,
                          });
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-200 transition-all cursor-pointer shadow-2xs"
                        title="Archive Campaign"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            isOpen: true,
                            action: 'delete',
                            id: campaign.id,
                            name: campaign.name,
                          });
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 w-full">
                <AlertCircle className="h-8 w-8 text-slate-400" />
                <p className="text-xs text-slate-500">No campaigns found matching criteria.</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        loading={confirmLoading}
        title={confirmModal.action === 'archive' ? 'Archive Campaign' : 'Move Campaign to Trash'}
        description={
          confirmModal.action === 'archive'
            ? `Are you sure you want to archive '${confirmModal.name}'? The automation will be paused and moved to your Archive. You can restore it anytime in Settings.`
            : `Are you sure you want to delete '${confirmModal.name}'? It will be moved to Trash. You can restore or permanently delete it in Settings.`
        }
        confirmText={confirmModal.action === 'archive' ? 'Archive Campaign' : 'Move to Trash'}
        variant={confirmModal.action === 'archive' ? 'warning' : 'danger'}
      />
    </div>
  );
}
