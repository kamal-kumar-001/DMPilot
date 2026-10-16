'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sparkles, Edit2, CheckCircle2, Loader2, Save, X } from 'lucide-react';
import { Button, Input, Label, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';

interface BillingPlan {
  id: string;
  key: 'FREE' | 'PRO' | 'ENTERPRISE';
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  campaignLimit: number;
  keywordLimit: number;
  dmLimitMonthly: number;
  updatedAt: string;
}

export function AdminPlans() {
  const [plans, setPlans] = React.useState<BillingPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingPlan, setEditingPlan] = React.useState<BillingPlan | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priceMonthly, setPriceMonthly] = React.useState(0);
  const [priceYearly, setPriceYearly] = React.useState(0);
  const [campaignLimit, setCampaignLimit] = React.useState(1);
  const [keywordLimit, setKeywordLimit] = React.useState(5);
  const [dmLimitMonthly, setDmLimitMonthly] = React.useState(100);

  const fetchPlans = async () => {
    try {
      const data = await apiRequest<BillingPlan[]>('/admin/plans');
      setPlans(data || []);
    } catch (error) {
      console.error('Failed to load billing plans', error);
      toast.error('Failed to load billing plans configurations');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPlans();
  }, []);

  const handleStartEdit = (plan: BillingPlan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description || '');
    setPriceMonthly(plan.priceMonthly);
    setPriceYearly(plan.priceYearly);
    setCampaignLimit(plan.campaignLimit);
    setKeywordLimit(plan.keywordLimit);
    setDmLimitMonthly(plan.dmLimitMonthly);
  };

  const handleSave = async () => {
    if (!editingPlan) return;
    setSaving(true);

    const toastId = toast.loading(`Saving modifications for ${editingPlan.key} plan...`);
    try {
      const updated = await apiRequest<BillingPlan>(`/admin/plans/${editingPlan.key}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          description: description || null,
          priceMonthly: Number(priceMonthly),
          priceYearly: Number(priceYearly),
          campaignLimit: Number(campaignLimit),
          keywordLimit: Number(keywordLimit),
          dmLimitMonthly: Number(dmLimitMonthly),
        }),
      });

      setPlans((prev) => prev.map((p) => (p.key === editingPlan.key ? updated : p)));
      toast.success(`${editingPlan.key} Billing Plan updated successfully!`, { id: toastId });
      setEditingPlan(null);
    } catch (error) {
      toast.error(`Failed to save plan configuration: Please verify your inputs.`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plans list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <Loader2 className="h-7 w-7 text-red-400 animate-spin" />
          <p className="text-xs text-gray-500">Loading plan configurations...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white border border-slate-200 relative p-5 rounded-2xl flex flex-col justify-between h-full shadow-xs hover:border-slate-300 transition-all"
            >
              {plan.key === 'PRO' && (
                <div className="absolute -top-3 right-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
                  Popular
                </div>
              )}

              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                      {plan.name}
                    </h3>
                    <span className="text-[9px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full text-slate-700 font-bold mt-1 inline-block">
                      {plan.key}
                    </span>
                  </div>
                  <Shield className="h-4 w-4 text-emerald-600/70" />
                </div>

                <p className="text-xs text-slate-600 mt-3 min-h-[32px] leading-relaxed">
                  {plan.description || 'No description configured.'}
                </p>

                {/* Price block */}
                <div className="pt-4 border-t border-slate-100 mt-4 space-y-1">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-extrabold text-slate-900">
                      ₹{plan.priceMonthly}
                    </span>
                    <span className="text-[10px] text-slate-500">/ month</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Yearly: <strong className="text-slate-900">₹{plan.priceYearly}</strong>
                  </div>
                </div>

                {/* Limits summary */}
                <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                    Plan Limits
                  </span>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>Max Campaigns</span>
                      <strong className="text-slate-900 font-extrabold">
                        {plan.campaignLimit === -1 ? 'Unlimited' : plan.campaignLimit}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Max Keywords</span>
                      <strong className="text-slate-900 font-extrabold">
                        {plan.keywordLimit === -1 ? 'Unlimited' : plan.keywordLimit}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Monthly DMs Limit</span>
                      <strong className="text-slate-900 font-extrabold">
                        {plan.dmLimitMonthly === -1
                          ? 'Unlimited'
                          : plan.dmLimitMonthly.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100">
                <Button
                  onClick={() => handleStartEdit(plan)}
                  variant="secondary"
                  className="w-full text-xs font-bold gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Configure Plan</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              onClick={() => setEditingPlan(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white border border-slate-200 p-6 rounded-2xl shadow-2xl z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    Edit {editingPlan.key} Plan
                  </h3>
                </div>
                <button
                  onClick={() => setEditingPlan(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form fields */}
              <div className="space-y-3 font-sans">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-name">Plan Label Name</Label>
                  <Input
                    id="plan-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Free Creator"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan-desc">Description</Label>
                  <textarea
                    id="plan-desc"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Basic features..."
                    className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-400 resize-none font-sans shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-price-m">Price Monthly (₹)</Label>
                    <Input
                      id="plan-price-m"
                      type="number"
                      value={priceMonthly}
                      onChange={(e) => setPriceMonthly(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-price-y">Price Yearly (₹)</Label>
                    <Input
                      id="plan-price-y"
                      type="number"
                      value={priceYearly}
                      onChange={(e) => setPriceYearly(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-camp">Campaigns Limit</Label>
                    <Input
                      id="plan-camp"
                      type="number"
                      value={campaignLimit}
                      onChange={(e) => setCampaignLimit(Number(e.target.value))}
                    />
                    <span className="text-[8px] text-slate-500">-1 = unlimited</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-kw">Keywords Limit</Label>
                    <Input
                      id="plan-kw"
                      type="number"
                      value={keywordLimit}
                      onChange={(e) => setKeywordLimit(Number(e.target.value))}
                    />
                    <span className="text-[8px] text-slate-500">-1 = unlimited</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-dm">Monthly DMs</Label>
                    <Input
                      id="plan-dm"
                      type="number"
                      value={dmLimitMonthly}
                      onChange={(e) => setDmLimitMonthly(Number(e.target.value))}
                    />
                    <span className="text-[8px] text-slate-500">-1 = unlimited</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  variant="secondary"
                  onClick={() => setEditingPlan(null)}
                  className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white font-bold gap-2 border-0 shadow-md shadow-emerald-950/10 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Plan Config</span>
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
