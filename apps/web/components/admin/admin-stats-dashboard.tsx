'use client';

import * as React from 'react';
import {
  Users,
  Layers,
  MessageSquare,
  IndianRupee,
  Activity,
  TrendingUp,
  Loader2,
  Calendar,
} from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

export function AdminStatsDashboard() {
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchStats = async () => {
    try {
      const data = await apiRequest<any>('/admin/stats');
      setStats(data);
    } catch (e) {
      console.error('Failed to load SaaS stats', e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-2">
        <Loader2 className="h-7 w-7 text-red-500 animate-spin" />
        <p className="text-xs text-gray-500">Retrieving system-wide SaaS metrics...</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Creators',
      value: stats?.creatorsCount ?? 0,
      description: 'Registered content creators',
      icon: Users,
      color: 'from-blue-500/20 to-indigo-500/5 border-blue-500/10 text-blue-400',
    },
    {
      label: 'Active Automations',
      value: stats?.campaignsCount ?? 0,
      description: 'Active comment & DM campaigns',
      icon: Layers,
      color: 'from-emerald-500/20 to-cyan-500/10 border-emerald-500/20 text-primary',
    },
    {
      label: 'DMs Automated',
      value: stats?.totalDMsSent ?? 0,
      description: 'Total private replies sent',
      icon: MessageSquare,
      color: 'from-amber-500/20 to-orange-500/5 border-amber-500/10 text-amber-400',
    },
    {
      label: 'Monthly Rec. Revenue',
      value: `₹${(stats?.mrr ?? 0).toLocaleString()}`,
      description: 'Current MRR run-rate',
      icon: IndianRupee,
      color: 'from-rose-500/20 to-pink-500/5 border-rose-500/10 text-rose-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Visual Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-2xl border bg-gradient-to-br ${card.color.split(' ')[0]} ${card.color.split(' ')[1]} bg-black/40 backdrop-blur-md flex flex-col justify-between h-[120px] shadow-lg`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {card.label}
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1">{card.value}</h3>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <card.icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="text-[10px] text-gray-500">{card.description}</p>
          </div>
        ))}
      </div>

      {/* Subscription Breakdown + Signups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
        {/* Tier Distribution Card */}
        <div className="lg:col-span-1 glass-card border border-white/5 rounded-2xl p-6 bg-black/20 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span>Subscription Breakdown</span>
            </h4>

            {/* List Tiers */}
            <div className="space-y-4 pt-2">
              {[
                {
                  name: 'Enterprise Tier',
                  count: stats?.tiers?.ENTERPRISE ?? 0,
                  price: '₹4,999/mo',
                  color: 'bg-rose-500',
                },
                {
                  name: 'Pro Tier',
                  count: stats?.tiers?.PRO ?? 0,
                  price: '₹999/mo',
                  color: 'bg-amber-500',
                },
                {
                  name: 'Free/Trial Tier',
                  count: stats?.tiers?.FREE ?? 0,
                  price: '₹0/mo',
                  color: 'bg-gray-600',
                },
              ].map((tier, idx) => {
                const total =
                  (stats?.tiers?.ENTERPRISE ?? 0) +
                    (stats?.tiers?.PRO ?? 0) +
                    (stats?.tiers?.FREE ?? 0) || 1;
                const percentage = Math.round((tier.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-300 font-semibold">{tier.name}</span>
                      <span className="text-gray-500 font-medium">
                        {tier.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${tier.color} transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 mt-6 flex justify-between items-center text-[10px] text-gray-500">
            <span>Active Subscribers</span>
            <span className="text-white font-bold">{stats?.activeSubscribers ?? 0}</span>
          </div>
        </div>

        {/* Recent Signups Feed */}
        <div className="lg:col-span-2 glass-card border border-white/5 rounded-2xl p-6 bg-black/20 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4 text-red-500" />
            <span>Recent Creator Signups</span>
          </h4>

          <div className="divide-y divide-white/5 pt-1 overflow-x-auto">
            {stats?.recentSignups?.length > 0 ? (
              stats.recentSignups.map((creator: any) => (
                <div
                  key={creator.id}
                  className="flex justify-between items-center py-3 text-[11px]"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">{creator.name || 'Anonymous Creator'}</p>
                    <p className="text-[10px] text-gray-500">{creator.email}</p>
                  </div>
                  <div className="flex items-center space-x-3 text-right">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[9px] font-bold text-gray-400 capitalize">
                      {creator.subscription?.plan || 'FREE'}
                    </span>
                    <span className="text-[9px] text-gray-500 flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(creator.createdAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 py-4 text-center">No creators registered yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Invoices Feed */}
      {stats?.recentInvoices && stats.recentInvoices.length > 0 && (
        <div className="glass-card border border-white/5 rounded-2xl p-6 bg-black/20 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-emerald-400" />
            <span>Live Revenue Stream & Recent Invoices</span>
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.recentInvoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 text-gray-400 text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-white">{inv.user?.name || 'Creator'}</p>
                      <p className="text-[10px] text-gray-500">{inv.user?.email}</p>
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {inv.plan} ({inv.cycle})
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-400">
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
