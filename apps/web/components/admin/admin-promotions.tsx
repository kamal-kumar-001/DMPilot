'use client';

import * as React from 'react';
import { Loader2, Megaphone, Save } from 'lucide-react';
import { toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';

interface PromoSettings {
  text: string;
  enabled: boolean;
  discountPercent: number;
}

export function AdminPromotions() {
  const [settings, setSettings] = React.useState<PromoSettings>({
    text: '',
    enabled: false,
    discountPercent: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    apiRequest<PromoSettings>('/admin/promo')
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => {
        console.error('Failed to load promo settings', err);
        toast.error('Failed to load promotions settings');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/admin/promo', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      toast.success('Promotions settings saved successfully!');
    } catch (err) {
      toast.error('Failed to save promotions settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs max-w-2xl">
      <div className="flex items-center space-x-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Promotional Banner & Discounts</h3>
          <p className="text-xs text-slate-500">
            Configure global discounts and the promotional banner for the landing page.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex flex-col space-y-0.5">
            <span className="text-xs font-bold text-slate-900">Enable Promotional Banner</span>
            <span className="text-[10px] text-slate-500">
              Toggles the display of the banner at the top of the landing page.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-5.5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.enabled ? 'bg-primary' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? 'translate-x-4.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Banner Text */}
        <div className="space-y-1.5">
          <label htmlFor="banner-text" className="text-xs font-bold text-slate-900">
            Banner Message
          </label>
          <textarea
            id="banner-text"
            rows={3}
            value={settings.text}
            onChange={(e) => setSettings((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Special launch discount! 30% off for the first 100 creators! Use code: LAUNCH30"
            className="w-full p-3 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400 resize-none font-sans shadow-xs"
            disabled={!settings.enabled}
          />
        </div>

        {/* Discount Percent */}
        <div className="space-y-1.5">
          <label htmlFor="discount-percent" className="text-xs font-bold text-slate-900">
            Discount Percentage (%)
          </label>
          <div className="flex items-center space-x-3">
            <input
              id="discount-percent"
              type="number"
              min={0}
              max={100}
              value={settings.discountPercent}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  discountPercent: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                }))
              }
              className="w-24 p-2.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-xs"
            />
            <span className="text-xs text-slate-500 font-medium">
              Applied automatically to all pricing tiers on the landing and checkout pages (0 = no
              discount).
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
