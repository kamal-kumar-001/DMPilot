'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Play,
  Pause,
  Edit,
  Trash2,
  Archive,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { Button, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface CampaignDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string | null;
  onEdit: (id: string) => void;
  onStatusToggle: (id: string, currentStatus: string, name: string) => void;
  onArchive: (id: string, name: string) => void;
  onDelete?: (id: string, name: string) => void;
}

interface CampaignDetail {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  createdAt: string;
  replyMessage: string;
  followCheckEnabled: boolean;
  instagramAccount?: {
    username: string;
    displayName?: string | null;
  } | null;
  keywords?: {
    id: string;
    keyword: string;
    matchingRule: string;
  }[];
  posts?: {
    mediaId: string;
    mediaUrl?: string | null;
    permalink?: string | null;
  }[];
}

export function CampaignDetailsModal({
  isOpen,
  onClose,
  campaignId,
  onEdit,
  onStatusToggle,
  onArchive,
  onDelete,
}: CampaignDetailsModalProps) {
  const [campaign, setCampaign] = React.useState<CampaignDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen && campaignId) {
      setLoading(true);
      apiRequest<CampaignDetail>(`/campaigns/${campaignId}`)
        .then((data) => {
          setCampaign(data);
        })
        .catch(() => {
          toast.error('Failed to load campaign details');
          onClose();
        })
        .finally(() => setLoading(false));
    } else {
      setCampaign(null);
    }
  }, [isOpen, campaignId, onClose]);

  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    action: 'archive' | 'delete';
  }>({
    isOpen: false,
    action: 'archive',
  });

  const handleToggle = async () => {
    if (!campaign) return;
    const currentStatus = campaign.status;
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    onStatusToggle(campaign.id, currentStatus, campaign.name);
    setCampaign((prev) => (prev ? { ...prev, status: nextStatus } : null));
  };

  const handleArchiveClick = () => {
    if (!campaign) return;
    setConfirmModal({ isOpen: true, action: 'archive' });
  };

  const handleDeleteClick = () => {
    if (!campaign) return;
    setConfirmModal({ isOpen: true, action: 'delete' });
  };

  const handleConfirmAction = () => {
    if (!campaign) return;
    if (confirmModal.action === 'archive') {
      onArchive(campaign.id, campaign.name);
    } else {
      if (onDelete) {
        onDelete(campaign.id, campaign.name);
      } else {
        onArchive(campaign.id, campaign.name);
      }
    }
    setConfirmModal({ isOpen: false, action: 'archive' });
    onClose();
  };

  const handleEditClick = () => {
    if (!campaign) return;
    onEdit(campaign.id);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Automation Details
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-xs">
              {loading || !campaign ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-slate-500">Fetching campaign setup details...</p>
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Status Badge & Name */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-extrabold text-slate-900">{campaign.name}</h2>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-bold ${
                          campaign.status === 'ACTIVE'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        {campaign.description}
                      </p>
                    )}
                  </div>

                  {/* General Config Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div className="space-y-1">
                      <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                        Channel
                      </span>
                      <span className="text-slate-900 font-bold block">
                        @{campaign.instagramAccount?.username || 'instagram_account'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                        Format Type
                      </span>
                      <span className="text-slate-900 font-bold block capitalize">
                        {campaign.type.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                        Created On
                      </span>
                      <span className="text-slate-900 block font-bold">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                        Follow Gate
                      </span>
                      <span
                        className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                          campaign.followCheckEnabled
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-slate-100 border border-slate-200 text-slate-600'
                        }`}
                      >
                        {campaign.followCheckEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    {campaign.keywords && campaign.keywords.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                          Match Rule
                        </span>
                        <span className="text-slate-900 block font-bold uppercase">
                          {campaign.keywords[0].matchingRule}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Keywords section */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                      Trigger Keywords
                    </h4>
                    {campaign.keywords && campaign.keywords.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {campaign.keywords.map((kw: any) => (
                          <span
                            key={kw.id}
                            className="bg-cyan-50 border border-cyan-200 text-cyan-800 px-2 py-0.5 rounded-lg font-bold text-[10px]"
                          >
                            {kw.keyword} ({kw.matchingRule.toLowerCase()})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 italic">
                        {campaign.type === 'COMMENT_TO_DM'
                          ? 'No keyword restrictions (triggers on any comment on the post)'
                          : 'No trigger keywords configured'}
                      </div>
                    )}
                  </div>

                  {/* Monitored Post section */}
                  {campaign.posts && campaign.posts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                        Monitored Post
                      </h4>
                      <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                        {campaign.posts[0].mediaUrl ? (
                          <img
                            src={campaign.posts[0].mediaUrl}
                            alt=""
                            className="h-14 w-14 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-[10px] text-slate-600 line-clamp-2">
                            Post ID:{' '}
                            <strong className="text-slate-900">{campaign.posts[0].mediaId}</strong>
                          </p>
                          {campaign.posts[0].permalink && (
                            <a
                              href={campaign.posts[0].permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-emerald-700 hover:underline font-bold cursor-pointer inline-block"
                            >
                              View live post
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DM Reply Template bubble mock */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                      Auto-Response DM Template
                    </h4>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col space-y-2">
                      <div className="text-[8px] text-slate-500 uppercase font-bold">
                        Mock Chat Preview
                      </div>
                      <div className="self-start bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white p-3.5 rounded-2xl rounded-tl-sm max-w-[85%] font-medium break-words whitespace-pre-line leading-relaxed shadow-sm">
                        {campaign.replyMessage}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            {campaign && !loading && (
              <div className="p-5 border-t border-slate-100 bg-white flex justify-between items-center gap-3">
                <div className="flex space-x-2">
                  <Button
                    onClick={handleToggle}
                    variant="secondary"
                    size="sm"
                    className="text-xs h-9 cursor-pointer flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-2xs font-semibold"
                  >
                    {campaign.status === 'ACTIVE' ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Activate</span>
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleEditClick}
                    variant="secondary"
                    size="sm"
                    className="text-xs h-9 cursor-pointer flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-2xs font-semibold"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleArchiveClick}
                    variant="secondary"
                    size="sm"
                    className="text-xs h-9 hover:text-amber-700 hover:border-amber-200 hover:bg-amber-50 text-slate-700 border border-slate-200 bg-white cursor-pointer flex items-center gap-1.5 shadow-2xs font-semibold"
                  >
                    <Archive className="h-3.5 w-3.5 text-amber-600" />
                    <span>Archive</span>
                  </Button>

                  <Button
                    onClick={handleDeleteClick}
                    variant="secondary"
                    size="sm"
                    className="text-xs h-9 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-slate-700 border border-slate-200 bg-white cursor-pointer flex items-center gap-1.5 shadow-2xs font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        title={confirmModal.action === 'archive' ? 'Archive Campaign' : 'Move Campaign to Trash'}
        description={
          confirmModal.action === 'archive'
            ? `Are you sure you want to archive '${campaign?.name}'? The campaign will be paused and stored in your Archive. You can restore it anytime in Settings.`
            : `Are you sure you want to delete '${campaign?.name}'? It will be moved to Trash. You can restore or permanently delete it in Settings.`
        }
        confirmText={confirmModal.action === 'archive' ? 'Archive Campaign' : 'Move to Trash'}
        variant={confirmModal.action === 'archive' ? 'warning' : 'danger'}
      />
    </AnimatePresence>
  );
}
