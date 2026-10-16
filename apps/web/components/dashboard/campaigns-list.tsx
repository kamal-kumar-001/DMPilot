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
  Trash,
  RefreshCw,
} from 'lucide-react';
import { Input, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';

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

  const handleArchive = async (id: string, name: string) => {
    const toastId = toast.loading(`Archiving campaign '${name}'...`);
    try {
      await apiRequest(`/campaigns/${id}/archive`, {
        method: 'POST',
      });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Archived campaign '${name}'`, {
        id: toastId,
      });
    } catch (error) {
      toast.error('Failed to archive campaign', { id: toastId });
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
    <div className="glass-card border-gradient p-5 rounded-xl shadow-glass flex flex-col space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-white">Active Automations</h3>
        </div>

        {/* Filters & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
            {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                  statusFilter === f
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchCampaigns()}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title="Refresh active automations"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500" />
        <Input
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 text-xs h-9"
        />
      </div>

      {/* Campaign List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px] custom-scrollbar flex flex-col justify-start pt-1 font-sans">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-[10px] text-gray-500">Loading campaigns...</p>
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
                    className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all flex items-center justify-between gap-4 cursor-pointer"
                  >
                    {/* Info block */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span
                          className="text-xs font-bold text-white truncate max-w-[150px]"
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
                      <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span className="truncate">
                          Channel:{' '}
                          <strong className="text-white">
                            @{campaign.instagramAccount?.username || 'linked'}
                          </strong>
                        </span>
                        <span className="flex items-center space-x-0.5 text-[9px] text-gray-500">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Campaign mini performance metrics */}
                      {campaign.metrics && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="bg-white/[0.02] border border-white/5 rounded-md px-2 py-1 flex flex-col justify-start">
                            <span className="text-[7px] text-gray-500 uppercase font-bold tracking-wider">
                              Comments
                            </span>
                            <span className="text-[10px] font-bold text-white mt-0.5">
                              {campaign.metrics.totalComments}
                            </span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 rounded-md px-2 py-1 flex flex-col justify-start">
                            <span className="text-[7px] text-gray-500 uppercase font-bold tracking-wider">
                              DMs Sent
                            </span>
                            <span className="text-[10px] font-bold text-white mt-0.5">
                              {campaign.metrics.totalDmsSent}
                            </span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 rounded-md px-2 py-1 flex flex-col justify-start">
                            <span className="text-[7px] text-gray-500 uppercase font-bold tracking-wider">
                              Success
                            </span>
                            <span className="text-[10px] font-extrabold text-primary mt-0.5">
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
                            ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
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
                        className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        title="Edit Campaign"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(campaign.id, campaign.name);
                        }}
                        className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-500 hover:text-red-400 hover:bg-white/10 transition-all cursor-pointer"
                        title="Archive Campaign"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 w-full">
                <AlertCircle className="h-8 w-8 text-gray-500" />
                <p className="text-xs text-gray-400">No campaigns found matching criteria.</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
