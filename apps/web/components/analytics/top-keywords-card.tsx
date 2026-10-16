'use client';

import * as React from 'react';
import { Hash, Zap } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api-client';

interface TopKeyword {
  keyword: string;
  matchingRule: string;
  campaignName: string;
  triggerCount: number;
}

const ruleColors: Record<string, string> = {
  EXACT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONTAINS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  STARTS_WITH: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function TopKeywordsCard() {
  const [keywords, setKeywords] = React.useState<TopKeyword[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchWithAuth<TopKeyword[]>('/analytics/top-keywords')
      .then((r) => setKeywords(Array.isArray(r) ? r : []))
      .catch(() => setKeywords([]))
      .finally(() => setLoading(false));
  }, []);

  const maxTriggers = keywords.length ? Math.max(...keywords.map((k) => k.triggerCount), 1) : 1;

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-accent-cyan" />
        <h3 className="text-sm font-bold text-slate-900">Top Keywords</h3>
        <span className="text-[10px] text-slate-500 ml-auto">by trigger count</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-9 rounded-lg bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : keywords.length === 0 ? (
        <div className="py-8 text-center">
          <Hash className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No keyword data yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keywords.map((kw, i) => {
            const barW = Math.round((kw.triggerCount / maxTriggers) * 100);
            const ruleClass =
              ruleColors[kw.matchingRule] ?? 'bg-slate-100 text-slate-600 border-slate-200';
            return (
              <div key={`${kw.keyword}-${i}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-slate-400 font-mono w-4">{i + 1}</span>
                    <span className="font-bold text-slate-900 text-xs">#{kw.keyword}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[8px] font-semibold ${ruleClass}`}
                    >
                      {kw.matchingRule}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-slate-500 truncate max-w-[80px]">
                      {kw.campaignName}
                    </span>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-cyan-700">
                      <Zap className="h-3 w-3" />
                      {kw.triggerCount}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-primary"
                    style={{ width: `${barW}%`, transition: 'width 0.8s ease' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
