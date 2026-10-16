'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  MessageSquare,
  Tag,
  DollarSign,
  Truck,
  Box,
  CheckCircle2,
  Loader2,
  RefreshCw,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { Button, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';

interface BuyerQueryItem {
  id: string;
  commentId: string;
  mediaId: string;
  text: string;
  username: string;
  userId: string;
  category: 'PRICE' | 'SHIPPING' | 'AVAILABILITY' | 'GENERAL';
  intentScore: number;
  suggestedReply: string;
  isReplied: boolean;
  createdAt: string;
  account: {
    id: string;
    username: string;
  };
}

export function ReplyDesk() {
  const [queries, setQueries] = useState<BuyerQueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [customReplyMap, setCustomReplyMap] = useState<Record<string, string>>({});
  const [replyModeMap, setReplyModeMap] = useState<Record<string, 'PUBLIC_COMMENT' | 'PRIVATE_DM'>>(
    {},
  );

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<BuyerQueryItem[]>('/instagram/reply-desk');
      setQueries(data || []);
    } catch (e) {
      console.error('Failed to load Reply Desk queries', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  const handleSendReply = async (query: BuyerQueryItem) => {
    const textToSend = customReplyMap[query.id] || query.suggestedReply;
    const mode = replyModeMap[query.id] || 'PUBLIC_COMMENT';
    if (!textToSend.trim()) return;

    setReplyingId(query.id);
    try {
      await apiRequest(`/instagram/reply-desk/${query.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ replyText: textToSend, replyMode: mode }),
      });
      const targetLabel = mode === 'PUBLIC_COMMENT' ? 'Public Comment Reply' : 'Private DM';
      toast.success(`${targetLabel} sent to @${query.username}! 🚀`);
      setQueries((prev) => prev.map((q) => (q.id === query.id ? { ...q, isReplied: true } : q)));
    } catch (e) {
      toast.error('Failed to dispatch reply message.');
    } finally {
      setReplyingId(null);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'PRICE':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Price & Rate Queries
          </span>
        );
      case 'SHIPPING':
        return (
          <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-bold flex items-center gap-1">
            <Truck className="w-3 h-3" /> Shipping & Location
          </span>
        );
      case 'AVAILABILITY':
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold flex items-center gap-1">
            <Box className="w-3 h-3" /> Details & Info
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1">
            <Tag className="w-3 h-3" /> Important Inquiries
          </span>
        );
    }
  };

  const filteredQueries = queries.filter((q) => {
    if (filterCategory === 'UNREPLIED') return !q.isReplied;
    if (filterCategory === 'REPLIED') return q.isReplied;
    if (filterCategory !== 'ALL') return q.category === filterCategory;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card border border-slate-200 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Reply Desk — Important Creator Comments & Inquiries
            </h3>
          </div>
          <p className="text-xs text-slate-600 max-w-xl">
            Automatically surfaces important follower inquiries, price questions, and details with
            1-click Public Comment Replies or Private DM responses.
          </p>
        </div>

        <Button
          onClick={fetchQueries}
          variant="secondary"
          size="sm"
          disabled={loading}
          className="text-xs font-bold gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </Button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: 'ALL', label: `All Inquiries (${queries.length})` },
          { id: 'UNREPLIED', label: `Pending (${queries.filter((q) => !q.isReplied).length})` },
          { id: 'PRICE', label: 'Price & Rates' },
          { id: 'SHIPPING', label: 'Shipping & Location' },
          { id: 'AVAILABILITY', label: 'Details & Info' },
          { id: 'REPLIED', label: 'Replied' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterCategory === cat.id
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Buyer Feed List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-xs text-slate-500">Fetching important comments...</p>
        </div>
      ) : filteredQueries.length === 0 ? (
        <div className="bg-white border border-slate-200 p-10 rounded-2xl text-center space-y-3 shadow-xs">
          <MessageSquare className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-900">No pending comments found</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Important inquiries asking for price, details, or info will automatically appear here
            for 1-click response.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQueries.map((q) => {
            const currentMode = replyModeMap[q.id] || 'PUBLIC_COMMENT';
            return (
              <div
                key={q.id}
                className={`bg-white border border-slate-200 p-5 rounded-2xl space-y-3 transition-all shadow-xs ${
                  q.isReplied ? 'opacity-75 bg-slate-50/50' : 'hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      @{q.username}
                    </span>
                    <span className="text-[10px] text-slate-500">via @{q.account.username}</span>
                    {getCategoryBadge(q.category)}
                  </div>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                    <span>Intent: {q.intentScore}%</span>
                    <span>•</span>
                    <span>
                      {new Date(q.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Comment text */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-800 font-medium leading-relaxed">
                  "{q.text}"
                </div>

                {/* AI Smart Reply Generator & Dispatch */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px]">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Suggested Response
                    </span>

                    {/* Reply Mode Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyModeMap((prev) => ({ ...prev, [q.id]: 'PUBLIC_COMMENT' }))
                        }
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          currentMode === 'PUBLIC_COMMENT'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <MessageCircle className="w-3 h-3" /> Public Comment Reply
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReplyModeMap((prev) => ({ ...prev, [q.id]: 'PRIVATE_DM' }))
                        }
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          currentMode === 'PRIVATE_DM'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Mail className="w-3 h-3" /> Private DM Reply
                      </button>
                    </div>

                    {q.isReplied && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Replied
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={customReplyMap[q.id] ?? q.suggestedReply}
                      onChange={(e) =>
                        setCustomReplyMap((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      disabled={q.isReplied || replyingId === q.id}
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 font-sans shadow-xs"
                    />
                    <Button
                      onClick={() => handleSendReply(q)}
                      disabled={q.isReplied || replyingId === q.id}
                      className="text-xs font-bold gap-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white flex-shrink-0 cursor-pointer shadow-xs"
                    >
                      {replyingId === q.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {q.isReplied
                          ? 'Replied'
                          : currentMode === 'PUBLIC_COMMENT'
                            ? 'Post Public Reply'
                            : 'Send Private DM'}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
