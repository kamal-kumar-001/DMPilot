'use client';

import * as React from 'react';
import { MessageSquare, MessageCircle, TrendingUp, Shield, RefreshCw } from 'lucide-react';

export default function DashboardMockup() {
  const barData = [30, 55, 42, 80, 65, 90, 72, 85, 60, 95, 78, 88, 50, 70];

  return (
    <section className="py-16 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            A dashboard that feels{' '}
            <span className="bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
              alive
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Real-time data, zero configuration. See every DM comment and campaign trigger at a
            glance.
          </p>
        </div>

        {/* Large Mockup Container */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl relative overflow-hidden">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: 'Total DMs Sent',
                value: '24,891',
                trend: '+18% this week',
                color: 'text-primary',
              },
              {
                label: 'Success Rate',
                value: '98.4%',
                trend: '+2% health',
                color: 'text-accent-cyan',
              },
              {
                label: 'Active Campaigns',
                value: '7 active',
                trend: '+1 new',
                color: 'text-amber-600',
              },
              {
                label: 'Comments Filtered',
                value: '31,240',
                trend: '+24% comments',
                color: 'text-pink-600',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between"
              >
                <p className={`text-xl sm:text-2xl font-black ${stat.color} mb-1`}>{stat.value}</p>
                <p className="text-[11px] text-slate-500 font-semibold tracking-wide mb-2 uppercase">
                  {stat.label}
                </p>
                <span className="text-[11px] font-bold text-slate-700">{stat.trend}</span>
              </div>
            ))}
          </div>

          {/* Interactive Visual Canvas */}
          <div className="bg-[#FAF9F5] border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-slate-800">24h Direct Message Volume</span>
              </div>
              <span className="text-xs font-bold text-slate-500">Live Webhook Feed</span>
            </div>

            {/* Simulated Chart Bars */}
            <div className="h-40 flex items-end justify-between gap-2 pt-6">
              {barData.map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-accent-cyan rounded-t-md opacity-85 group-hover:opacity-100 transition-all"
                    style={{ height: `${val}%` }}
                  />
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    {idx + 1}h
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
