'use client';

import * as React from 'react';
import {
  Archive,
  Trash2,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Loader2,
  Calendar,
  Instagram,
  CheckCircle2,
} from 'lucide-react';
import { Button, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface ArchivedCampaign {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  deletedAt?: string | null;
  updatedAt: string;
  isDeleted: boolean;
  isArchived: boolean;
  instagramAccount?: {
    username: string;
    displayName?: string | null;
  } | null;
  keywords?: { keyword: string }[];
  posts?: { mediaId: string; permalink?: string | null }[];
}

export function SettingsArchivedCampaigns() {
  const [campaigns, setCampaigns] = React.useState<ArchivedCampaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'ALL' | 'ARCHIVED' | 'TRASH'>('ALL');

  // Confirmation modal state
  const [modalState, setModalState] = React.useState<{
    isOpen: boolean;
    type: 'restore' | 'permanentDelete';
    campaignId: string;
    campaignName: string;
  }>({
    isOpen: false,
    type: 'restore',
    campaignId: '',
    campaignName: '',
  });
  const [actionLoading, setActionLoading] = React.useState(false);

  const fetchCampaigns = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<ArchivedCampaign[]>('/campaigns/archived-and-deleted');
      setCampaigns(data || []);
    } catch (err) {
      toast.error('Failed to load archived and deleted campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleOpenRestoreModal = (id: string, name: string) => {
    setModalState({
      isOpen: true,
      type: 'restore',
      campaignId: id,
      campaignName: name,
    });
  };

  const handleOpenPermanentDeleteModal = (id: string, name: string) => {
    setModalState({
      isOpen: true,
      type: 'permanentDelete',
      campaignId: id,
      campaignName: name,
    });
  };

  const handleConfirmAction = async () => {
    const { type, campaignId, campaignName } = modalState;
    if (!campaignId) return;

    setActionLoading(true);
    try {
      if (type === 'restore') {
        await apiRequest(`/campaigns/${campaignId}/restore`, {
          method: 'POST',
        });
        toast.success(`'${campaignName}' restored successfully!`, {
          description: 'The automation is now in your Campaign Builder (Paused).',
        });
      } else {
        await apiRequest(`/campaigns/${campaignId}/permanent`, {
          method: 'DELETE',
        });
        toast.success(`'${campaignName}' permanently deleted.`);
      }
      setModalState((prev) => ({ ...prev, isOpen: false }));
      fetchCampaigns();
    } catch (err) {
      toast.error(
        type === 'restore' ? 'Failed to restore campaign' : 'Failed to permanently delete campaign',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (filter === 'ARCHIVED') return c.isArchived;
    if (filter === 'TRASH') return c.isDeleted;
    return true;
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
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Archived & Deleted Campaigns</h2>
            <p className="text-xs text-slate-500">
              Restore paused automations back to your dashboard or permanently purge them
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filters */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['ALL', 'ARCHIVED', 'TRASH'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={fetchCampaigns}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <p className="text-xs text-slate-500">Loading archived and deleted campaigns...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">No campaigns found in this view.</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            When you archive or delete campaigns from your Automations list, they will safely appear
            here for restoration or cleanup.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">{c.name}</span>

                  {c.isDeleted ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      Trash
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      Archived
                    </span>
                  )}

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCampaignBadgeColor(
                      c.type,
                    )}`}
                  >
                    {c.type.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  {c.instagramAccount?.username && (
                    <span className="flex items-center gap-1 font-medium text-slate-600">
                      <Instagram className="h-3 w-3 text-pink-600" /> @{c.instagramAccount.username}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {new Date(c.deletedAt || c.updatedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Button
                  onClick={() => handleOpenRestoreModal(c.id, c.name)}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 cursor-pointer flex items-center gap-1.5 border border-slate-200 bg-white text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200 shadow-2xs font-semibold"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restore</span>
                </Button>

                <Button
                  onClick={() => handleOpenPermanentDeleteModal(c.id, c.name)}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 cursor-pointer flex items-center gap-1.5 border border-slate-200 bg-white text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 shadow-2xs font-semibold"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Delete Permanently</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
        title={modalState.type === 'restore' ? 'Restore Campaign' : 'Permanently Delete Campaign'}
        description={
          modalState.type === 'restore'
            ? `Are you sure you want to restore '${modalState.campaignName}'? It will be moved back to your Active Automations in a paused state so you can review and enable it.`
            : `Are you sure you want to permanently delete '${modalState.campaignName}'? This action CANNOT be undone and will permanently remove all associated keywords, post links, and records.`
        }
        confirmText={modalState.type === 'restore' ? 'Restore Automation' : 'Permanently Delete'}
        variant={modalState.type === 'restore' ? 'primary' : 'danger'}
      />
    </div>
  );
}
