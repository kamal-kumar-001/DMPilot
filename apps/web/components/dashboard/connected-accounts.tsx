'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Instagram, CheckCircle, RefreshCw, LogOut, Link2, Loader2 } from 'lucide-react';
import { toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { useCreatorQuery } from '@/lib/use-creator-query';

interface ConnectedAccount {
  id: string;
  instagramId: string;
  username: string;
  displayName: string | null;
  profilePicture: string | null;
  isConnected: boolean;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  createdAt: string;
  lastActiveAt?: string;
  automationStatus?: 'HEALTHY' | 'ATTENTION_NEEDED';
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Active now';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) return 'Active just now';
  if (diffMins < 60) return `Active ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Active ${diffDays}d ago`;
}

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

export function ConnectedAccounts() {
  const {
    data: accounts = [],
    loading,
    refetch: fetchAccounts,
  } = useCreatorQuery<ConnectedAccount[]>('/instagram');
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);

  const handleVerifyAndRepair = async (id: string, username: string) => {
    setVerifyingId(id);
    const toastId = toast.loading(`Verifying @${username} automation link...`);
    try {
      const res = await apiRequest<{
        status: 'HEALTHY' | 'REPAIRED' | 'ERROR';
        message: string;
      }>(`/instagram/${id}/verify-webhook`, {
        method: 'POST',
      });

      if (res.status === 'ERROR') {
        toast.error(res.message, { id: toastId });
      } else if (res.status === 'REPAIRED') {
        toast.success(`Webhook connection repaired for @${username}!`, { id: toastId });
        await fetchAccounts();
      } else {
        toast.success(`Active & ready: @${username} is receiving automations`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(`Verification failed: ${error?.message || 'Meta API unreachable'}`, {
        id: toastId,
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDisconnect = async (id: string, username: string) => {
    const toastId = toast.loading(`Disconnecting @${username}...`);
    try {
      await apiRequest(`/instagram/${id}`, {
        method: 'DELETE',
      });
      await fetchAccounts();
      toast.error(`Disconnected @${username} Instagram channel`, { id: toastId });
    } catch (error) {
      toast.error(`Failed to disconnect @${username}`, { id: toastId });
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Instagram className="h-5 w-5 text-pink-500" />
          <h3 className="text-sm font-bold text-slate-900">Linked Channels</h3>
        </div>

        <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-semibold">
          {loading ? '...' : `${accounts.length} Connected`}
        </span>
      </div>

      {/* Account List */}
      <div className="overflow-y-auto space-y-3 pr-1 max-h-[330px] custom-scrollbar flex flex-col justify-start pt-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-[10px] text-slate-500">Loading channels...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {accounts.length > 0 ? (
              <div className="space-y-3 w-full self-start">
                {accounts.map((account, i) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    {/* Account details */}
                    <div className="flex items-center space-x-3 min-w-0">
                      {account.profilePicture ? (
                        <img
                          src={account.profilePicture}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover flex-shrink-0 border border-slate-200"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center text-white font-extrabold text-sm shadow-sm flex-shrink-0">
                          {account.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          @{account.username}
                        </span>
                        <div className="flex items-center space-x-1.5 text-[9px] text-slate-500 font-semibold mt-0.5 truncate">
                          <span>{formatNumber(account.followersCount)} followers</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium">
                            {formatRelativeTime(account.lastActiveAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status and Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {/* Health check badge */}
                      {account.automationStatus === 'ATTENTION_NEEDED' ? (
                        <span
                          className="flex items-center space-x-1 text-[8px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold"
                          title="Last send encountered an issue. Tap refresh to verify."
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Check</span>
                        </span>
                      ) : (
                        <span
                          className="flex items-center space-x-1 text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold"
                          title="Webhooks active & responding"
                        >
                          <CheckCircle className="h-2 w-2 text-emerald-600" />
                          <span>Ready</span>
                        </span>
                      )}

                      {/* Options */}
                      <button
                        onClick={() => handleVerifyAndRepair(account.id, account.username)}
                        disabled={verifyingId === account.id}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
                        title="Verify & Repair Webhook Link"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${verifyingId === account.id ? 'animate-spin text-primary' : ''}`}
                        />
                      </button>
                      <button
                        onClick={() => handleDisconnect(account.id, account.username)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Disconnect Account"
                      >
                        <LogOut className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 w-full">
                <Link2 className="h-10 w-10 text-slate-400 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900">No Linked Channels</p>
                  <p className="text-[10px] text-slate-500 max-w-xs px-2">
                    Connect your Instagram Professional accounts to start automation flows.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
