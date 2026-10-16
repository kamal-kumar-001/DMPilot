'use client';

import * as React from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';

interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabledForPlans: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const ALL_PLANS = ['FREE', 'PRO', 'ENTERPRISE'];

const planColors: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-700 border-slate-300',
  PRO: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  ENTERPRISE: 'bg-amber-50 text-amber-800 border-amber-300',
};

export function AdminFeatureFlags() {
  const [flags, setFlags] = React.useState<FeatureFlag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    apiRequest<FeatureFlag[]>('/admin/flags')
      .then((r) => setFlags(Array.isArray(r) ? r : []))
      .catch(() => setFlags([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleEnabled = async (flag: FeatureFlag) => {
    setSaving(flag.key);
    try {
      await apiRequest(`/admin/flags/${flag.key}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !flag.isEnabled }),
      });
      toast.success(`Flag ${flag.key} ${flag.isEnabled ? 'disabled' : 'enabled'}`);
      load();
    } catch {
      toast.error('Failed to update flag');
    } finally {
      setSaving(null);
    }
  };

  const togglePlan = async (flag: FeatureFlag, plan: string) => {
    const currentPlans = flag.enabledForPlans.split(',').filter(Boolean);
    const newPlans = currentPlans.includes(plan)
      ? currentPlans.filter((p) => p !== plan)
      : [...currentPlans, plan];
    setSaving(flag.key + plan);
    try {
      await apiRequest(`/admin/flags/${flag.key}/plans`, {
        method: 'PATCH',
        body: JSON.stringify({ plans: newPlans }),
      });
      toast.success('Plans updated');
      load();
    } catch {
      toast.error('Failed to update plans');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Toggle features on/off and control which plans have access.
        </p>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const enabledPlans = flag.enabledForPlans.split(',').filter(Boolean);
            const isSaving = saving === flag.key;
            return (
              <div
                key={flag.key}
                className={`bg-white border border-slate-200 rounded-xl p-4 shadow-xs transition-all ${!flag.isEnabled ? 'opacity-65' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 font-mono">{flag.key}</span>
                      {!flag.isEnabled && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-bold">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>
                  </div>
                  <button
                    onClick={() => toggleEnabled(flag)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      flag.isEnabled ? 'bg-primary' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        flag.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Plan checkboxes */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-[10px] text-slate-500 mr-1 font-semibold">Plans:</span>
                  {ALL_PLANS.map((plan) => {
                    const active = enabledPlans.includes(plan);
                    const key = flag.key + plan;
                    return (
                      <button
                        key={plan}
                        onClick={() => togglePlan(flag, plan)}
                        disabled={saving === key}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 cursor-pointer ${active ? planColors[plan] : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {saving === key ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : active ? (
                          <Check className="h-2.5 w-2.5" />
                        ) : (
                          <X className="h-2.5 w-2.5" />
                        )}
                        {plan}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
