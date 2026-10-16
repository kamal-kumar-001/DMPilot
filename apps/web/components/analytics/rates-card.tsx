'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface RatesData {
  sent: number;
  failed: number;
  pending: number;
  successRate: number;
  failureRate: number;
}

function RateArc({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 40,
    cx = 56,
    cy = 56;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[112px] h-[112px] flex items-center justify-center">
        <svg width={112} height={112} className="-rotate-90 absolute inset-0">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={10} />
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          <p className="text-xl font-black text-slate-900 leading-none">{pct}%</p>
          <p className="text-[10px] text-slate-500 font-semibold mt-1 leading-none">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function RatesCard() {
  const [data, setData] = React.useState<RatesData | null>(null);

  React.useEffect(() => {
    fetchWithAuth<RatesData>('/analytics/rates')
      .then((r) => (typeof r?.sent === 'number' ? setData(r) : null))
      .catch(() => null);
  }, []);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-900">DM Rates</h3>
      </div>

      {!data ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-20 rounded-xl bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-around">
            <RateArc pct={data.successRate} color="#00BB88" label="Success" />
            <RateArc pct={data.failureRate} color="#f87171" label="Failed" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {[
              { icon: CheckCircle2, label: 'Sent', val: data.sent, color: 'text-emerald-600' },
              { icon: XCircle, label: 'Failed', val: data.failed, color: 'text-rose-500' },
            ].map(({ icon: Icon, label, val, color }) => (
              <div
                key={label}
                className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-center shadow-2xs"
              >
                <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                <p className="text-lg font-black text-slate-900">{val}</p>
                <p className="text-[9px] text-slate-500 font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
