'use client';

import * as React from 'react';
import { Megaphone, Plus, DollarSign, Eye, MessageSquare, Loader2 } from 'lucide-react';
import { Button, Input, Label, toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { CustomSelect } from '@/components/ui/custom-select';

interface ConnectedAccount {
  id: string;
  username: string;
  displayName?: string | null;
}

interface AdCampaignItem {
  id: string;
  name: string;
  objective: 'OUTCOME_ENGAGEMENT' | 'OUTCOME_MESSAGES' | 'OUTCOME_TRAFFIC';
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  dailyBudgetPaise: number;
  spendPaise: number;
  impressions: number;
  clicks: number;
  messagesStarted: number;
  createdAt: string;
  instagramAccount?: {
    username: string;
  };
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = React.useState<AdCampaignItem[]>([]);
  const [accounts, setAccounts] = React.useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Modal State
  const [showModal, setShowModal] = React.useState(false);
  const [selectedAccountId, setSelectedAccountId] = React.useState('');
  const [name, setName] = React.useState('');
  const [objective, setObjective] = React.useState<'OUTCOME_ENGAGEMENT' | 'OUTCOME_MESSAGES'>(
    'OUTCOME_ENGAGEMENT',
  );
  const [dailyBudgetPaise, setDailyBudgetPaise] = React.useState(50000); // ₹500
  const [creating, setCreating] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [camps, accs] = await Promise.all([
        apiRequest<AdCampaignItem[]>('/ads'),
        apiRequest<ConnectedAccount[]>('/instagram'),
      ]);

      setCampaigns(Array.isArray(camps) ? camps : []);
      const validAccs = Array.isArray(accs) ? accs : [];
      setAccounts(validAccs);
      if (validAccs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(validAccs[0].id);
      }
    } catch (err: any) {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Enter a campaign name');
      return;
    }
    if (!selectedAccountId) {
      toast.error('Select an account');
      return;
    }

    setCreating(true);
    try {
      const res = await apiRequest<{ deliveryNote?: string }>('/ads/boost', {
        method: 'POST',
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          name: name.trim(),
          objective,
          dailyBudgetPaise,
        }),
      });

      toast.success(res?.deliveryNote || 'Campaign recorded');
      setShowModal(false);
      setName('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to launch campaign');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Ads</h1>
          <p className="text-xs text-slate-500 mt-0.5">Plan Instagram boosted posts</p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 text-xs font-bold self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New ad plan</span>
        </Button>
      </div>

      {/* Delivery disclosure: boosts are local records until Meta Ads is connected */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start space-x-3">
        <svg
          className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
        <p className="text-xs text-amber-800 leading-relaxed">
          Meta Ads delivery is not connected yet. Campaigns here are recorded locally to plan and
          measure DM conversion - they do not run ads on Instagram and never spend money.
        </p>
      </div>

      {/* Metrics row: ad delivery is not connected, so every stat is a plain
          0 with an unmistakable Coming soon label - never a measured result. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Active ads',
            icon: Megaphone,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100/80',
          },
          {
            title: 'Total spend',
            icon: DollarSign,
            color: 'text-blue-600 bg-blue-50 border-blue-100/80',
          },
          {
            title: 'Impressions',
            icon: Eye,
            color: 'text-purple-600 bg-purple-50 border-purple-100/80',
          },
          {
            title: 'DMs from ads',
            icon: MessageSquare,
            color: 'text-amber-600 bg-amber-50 border-amber-100/80',
          },
        ].map((card, idx) => (
          <div
            key={idx}
            className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{card.title}</span>
              <div className={`p-2 rounded-xl border ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-slate-400 tracking-tight">0</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200/60">
              Coming soon
            </span>
          </div>
        ))}
      </div>

      {/* Campaigns Table */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Your ad plans
          </h2>
          <span className="text-xs font-medium text-slate-500">{campaigns.length} total</span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading campaigns...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No ad plans yet. Click &quot;New ad plan&quot; to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Goal</th>
                  <th className="px-6 py-3">Daily budget</th>
                  <th className="px-6 py-3">Results</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div>
                        <span>{camp.name}</span>
                        {camp.instagramAccount?.username && (
                          <p className="text-[10px] text-slate-400 font-normal">
                            @{camp.instagramAccount.username}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {camp.objective === 'OUTCOME_MESSAGES' ? 'Direct Messages' : 'Engagement'}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-semibold">
                      {formatCurrency(camp.dailyBudgetPaise)}/day
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200/60">
                        Coming soon
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                        Not running
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-sm font-bold text-slate-900">New ad plan</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved as a local plan only. Nothing is sent to Meta and no ads run yet.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ad-account" className="text-xs font-semibold text-slate-700">
                  Account
                </Label>
                <CustomSelect
                  id="ad-account"
                  value={selectedAccountId}
                  onChange={(val) => setSelectedAccountId(val)}
                  options={accounts.map((acc) => ({
                    value: acc.id,
                    label: `@${acc.username}${acc.displayName ? ` (${acc.displayName})` : ''}`,
                  }))}
                  placeholder="Select Instagram Account"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campName" className="text-xs font-semibold text-slate-700">
                  Campaign Name
                </Label>
                <Input
                  id="campName"
                  placeholder="e.g. Summer Reel Boost / VIP Promo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Goal Objective</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'OUTCOME_ENGAGEMENT' as const, label: 'Engagement & Comments' },
                    { id: 'OUTCOME_MESSAGES' as const, label: 'Direct Messages' },
                  ].map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setObjective(obj.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        objective === obj.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {obj.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <Label className="font-semibold text-slate-700">Daily Budget</Label>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(dailyBudgetPaise)} / day
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[20000, 50000, 100000, 250000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setDailyBudgetPaise(amount)}
                      className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        dailyBudgetPaise === amount
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={creating || !name.trim()}
                  className="text-xs font-bold text-white shadow-brand"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-white" />}
                  Save plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
