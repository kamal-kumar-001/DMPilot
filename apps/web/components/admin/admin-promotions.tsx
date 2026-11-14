'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Megaphone,
  Save,
  Tag,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  X,
  Users,
  Percent,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button, Input, Label, toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';

interface PromoSettings {
  text: string;
  enabled: boolean;
  discountPercent: number;
}

interface CouponItem {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number; // For PERCENTAGE: 1-100; for FIXED_AMOUNT: paise
  maxDiscountPaise: number | null;
  minOrderAmountPaise: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  totalRedemptions?: number;
  applicablePlans: string;
  applicableCycles: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string | null;
  createdAt: string;
}

interface RedemptionItem {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  discountPaise: number;
  orderAmountPaise: number;
  createdAt: string;
}

export function AdminPromotions() {
  // ─── Promo Banner Settings State ────────────────────────────────
  const [settings, setSettings] = React.useState<PromoSettings>({
    text: '',
    enabled: false,
    discountPercent: 0,
  });
  const [promoLoading, setPromoLoading] = React.useState(true);
  const [promoSaving, setPromoSaving] = React.useState(false);

  // ─── Coupons State ──────────────────────────────────────────────
  const [coupons, setCoupons] = React.useState<CouponItem[]>([]);
  const [couponsLoading, setCouponsLoading] = React.useState(true);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCoupon, setEditingCoupon] = React.useState<CouponItem | null>(null);
  const [modalSaving, setModalSaving] = React.useState(false);

  // Form fields
  const [formCode, setFormCode] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formDiscountType, setFormDiscountType] = React.useState<'PERCENTAGE' | 'FIXED_AMOUNT'>(
    'PERCENTAGE',
  );
  const [formDiscountValue, setFormDiscountValue] = React.useState<number | string>(20);
  const [formMaxDiscountRupees, setFormMaxDiscountRupees] = React.useState<number | string>('');
  const [formMinOrderRupees, setFormMinOrderRupees] = React.useState<number | string>('');
  const [formMaxRedemptions, setFormMaxRedemptions] = React.useState<number | string>('');
  const [formMaxPerUser, setFormMaxPerUser] = React.useState<number | string>(1);
  const [formPlans, setFormPlans] = React.useState<string[]>(['PRO', 'ENTERPRISE']);
  const [formCycles, setFormCycles] = React.useState<string[]>(['MONTHLY', 'YEARLY']);
  const [formIsActive, setFormIsActive] = React.useState(true);
  const [formExpiresAt, setFormExpiresAt] = React.useState('');

  // Redemptions View Modal State
  const [viewingRedemptionsCoupon, setViewingRedemptionsCoupon] = React.useState<CouponItem | null>(
    null,
  );
  const [redemptions, setRedemptions] = React.useState<RedemptionItem[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = React.useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────
  const fetchPromoSettings = async () => {
    try {
      const data = await apiRequest<PromoSettings>('/admin/promo');
      if (data) setSettings(data);
    } catch (err) {
      console.error('Failed to load promo settings', err);
      toast.error('Failed to load promotional settings');
    } finally {
      setPromoLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      const data = await apiRequest<CouponItem[]>('/admin/coupons');
      setCoupons(data || []);
    } catch (err) {
      console.error('Failed to load coupons', err);
      toast.error('Failed to load coupon list');
    } finally {
      setCouponsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPromoSettings();
    fetchCoupons();
  }, []);

  // ─── Promo Banner Handlers ──────────────────────────────────────
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoSaving(true);
    try {
      await apiRequest('/admin/promo', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      toast.success('Promotions settings saved successfully!');
    } catch {
      toast.error('Failed to save promotions settings');
    } finally {
      setPromoSaving(false);
    }
  };

  // ─── Coupon Actions ─────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormCode('');
    setFormDescription('');
    setFormDiscountType('PERCENTAGE');
    setFormDiscountValue(20);
    setFormMaxDiscountRupees('');
    setFormMinOrderRupees('');
    setFormMaxRedemptions('');
    setFormMaxPerUser(1);
    setFormPlans(['PRO', 'ENTERPRISE']);
    setFormCycles(['MONTHLY', 'YEARLY']);
    setFormIsActive(true);
    setFormExpiresAt('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: CouponItem) => {
    setEditingCoupon(c);
    setFormCode(c.code);
    setFormDescription(c.description || '');
    setFormDiscountType(c.discountType);
    setFormDiscountValue(c.discountType === 'PERCENTAGE' ? c.discountValue : c.discountValue / 100);
    setFormMaxDiscountRupees(c.maxDiscountPaise ? c.maxDiscountPaise / 100 : '');
    setFormMinOrderRupees(c.minOrderAmountPaise ? c.minOrderAmountPaise / 100 : '');
    setFormMaxRedemptions(c.maxRedemptions ?? '');
    setFormMaxPerUser(c.maxRedemptionsPerUser ?? 1);
    setFormPlans(
      c.applicablePlans ? c.applicablePlans.split(',').map((p) => p.trim()) : ['PRO', 'ENTERPRISE'],
    );
    setFormCycles(
      c.applicableCycles
        ? c.applicableCycles.split(',').map((cy) => cy.trim())
        : ['MONTHLY', 'YEARLY'],
    );
    setFormIsActive(c.isActive);
    setFormExpiresAt(c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : '');
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = formCode.trim().toUpperCase();
    if (!code) {
      toast.error('Coupon code is required');
      return;
    }
    const val = Number(formDiscountValue);
    if (!val || val <= 0) {
      toast.error('Please enter a valid discount value');
      return;
    }
    if (formDiscountType === 'PERCENTAGE' && val > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }
    if (formPlans.length === 0) {
      toast.error('Select at least one applicable plan');
      return;
    }
    if (formCycles.length === 0) {
      toast.error('Select at least one applicable billing cycle');
      return;
    }

    setModalSaving(true);
    try {
      const payload: any = {
        description: formDescription.trim() || undefined,
        discountType: formDiscountType,
        discountValue: formDiscountType === 'PERCENTAGE' ? Math.round(val) : Math.round(val * 100),
        maxDiscountPaise: formMaxDiscountRupees
          ? Math.round(Number(formMaxDiscountRupees) * 100)
          : null,
        minOrderAmountPaise: formMinOrderRupees
          ? Math.round(Number(formMinOrderRupees) * 100)
          : null,
        maxRedemptions: formMaxRedemptions ? Number(formMaxRedemptions) : null,
        maxRedemptionsPerUser: Number(formMaxPerUser) || 1,
        applicablePlans: formPlans.join(','),
        applicableCycles: formCycles.join(','),
        isActive: formIsActive,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      };

      if (editingCoupon) {
        await apiRequest(`/admin/coupons/${editingCoupon.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success(`Coupon ${editingCoupon.code} updated!`);
      } else {
        payload.code = code;
        await apiRequest('/admin/coupons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Coupon ${code} created successfully!`);
      }

      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save coupon');
    } finally {
      setModalSaving(false);
    }
  };

  const handleToggleActive = async (c: CouponItem) => {
    try {
      await apiRequest(`/admin/coupons/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      setCoupons((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, isActive: !item.isActive } : item)),
      );
      toast.success(`Coupon ${c.code} is now ${!c.isActive ? 'active' : 'inactive'}`);
    } catch {
      toast.error('Failed to toggle coupon status');
    }
  };

  const handleDeleteCoupon = async (c: CouponItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete coupon "${c.code}"?`)) {
      return;
    }
    try {
      await apiRequest(`/admin/coupons/${c.id}`, {
        method: 'DELETE',
      });
      setCoupons((prev) => prev.filter((item) => item.id !== c.id));
      toast.success(`Coupon ${c.code} deleted`);
    } catch {
      toast.error('Failed to delete coupon');
    }
  };

  const copyShareLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dmpilot.org';
    const link = `${origin}/checkout?plan=PRO&coupon=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    toast.success('Shareable checkout link copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const viewRedemptions = async (c: CouponItem) => {
    setViewingRedemptionsCoupon(c);
    setRedemptionsLoading(true);
    try {
      const data = await apiRequest<RedemptionItem[]>(`/admin/coupons/${c.id}/redemptions`);
      setRedemptions(data || []);
    } catch {
      toast.error('Failed to load redemptions');
    } finally {
      setRedemptionsLoading(false);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────
  const activeCouponsCount = coupons.filter((c) => c.isActive).length;
  const totalRedemptionsCount = coupons.reduce((sum, c) => sum + (c.redemptionCount || 0), 0);

  const isExpired = (c: CouponItem) => {
    return c.expiresAt && new Date(c.expiresAt) < new Date();
  };

  return (
    <div className="space-y-8">
      {/* ─── Global Promotional Banner Card ─── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs max-w-3xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Promotional Banner & Discounts</h3>
            <p className="text-xs text-slate-500">
              Configure global landing page banner and universal tier discount.
            </p>
          </div>
        </div>

        {promoLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSavePromo} className="space-y-5">
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
                rows={2}
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
                Default Landing Discount (%)
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
                      discountPercent: Math.max(
                        0,
                        Math.min(100, parseInt(e.target.value, 10) || 0),
                      ),
                    }))
                  }
                  className="w-24 p-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-xs"
                />
                <span className="text-xs text-slate-500 font-medium">
                  Applied to pricing tiers on the landing and checkout pages when no custom coupon
                  is used.
                </span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={promoSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                {promoSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ─── Coupons Section ─── */}
      <div className="space-y-4">
        {/* Header & KPI Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Promotional Coupon Codes</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Create and share custom discount codes with percentage or fixed-amount discounts,
              usage caps, and expiration dates.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Coupon
          </button>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Coupons
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{coupons.length}</span>
              <Tag className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Coupons
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600">{activeCouponsCount}</span>
              <Check className="w-4 h-4 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Redemptions
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-primary">{totalRedemptionsCount}</span>
              <Users className="w-4 h-4 text-primary" />
            </div>
          </div>
        </div>

        {/* Coupons Table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {couponsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Tag className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-900">No coupon codes yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Create promotional coupons to reward your partners, influencers, or special event
                campaigns.
              </p>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Create your first coupon
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-600 font-bold">
                    <th className="py-3 px-4">Coupon Code</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4">Redemptions</th>
                    <th className="py-3 px-4">Applicable</th>
                    <th className="py-3 px-4">Status & Validity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map((c) => {
                    const expired = isExpired(c);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Code */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 border border-slate-200 tracking-wider">
                              {c.code}
                            </span>
                            <button
                              onClick={() => copyShareLink(c.code)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
                              title="Copy shareable checkout link"
                            >
                              {copiedCode === c.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {c.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">
                              {c.description}
                            </p>
                          )}
                        </td>

                        {/* Discount */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">
                            {c.discountType === 'PERCENTAGE'
                              ? `${c.discountValue}% OFF`
                              : `₹${(c.discountValue / 100).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })} OFF`}
                          </span>
                          {c.maxDiscountPaise && c.discountType === 'PERCENTAGE' && (
                            <p className="text-[10px] text-slate-500">
                              Cap: ₹{(c.maxDiscountPaise / 100).toFixed(0)}
                            </p>
                          )}
                        </td>

                        {/* Redemptions */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => viewRedemptions(c)}
                            className="font-bold text-slate-800 hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                            title="Click to view redemption audit logs"
                          >
                            <span>
                              {c.redemptionCount} / {c.maxRedemptions ?? '∞'}
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                          <p className="text-[10px] text-slate-500">
                            Max {c.maxRedemptionsPerUser} / user
                          </p>
                        </td>

                        {/* Applicable */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <span className="text-slate-700 font-semibold">
                              {c.applicablePlans || 'All Plans'}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              {c.applicableCycles
                                ? c.applicableCycles.toLowerCase()
                                : 'monthly, yearly'}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {expired ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Expired
                              </span>
                            ) : c.isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Inactive
                              </span>
                            )}
                          </div>
                          {c.expiresAt && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Exp: {new Date(c.expiresAt).toLocaleDateString()}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(c)}
                              className={`relative inline-flex h-4.5 w-8 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                c.isActive ? 'bg-primary' : 'bg-slate-200'
                              }`}
                              title={c.isActive ? 'Deactivate coupon' : 'Activate coupon'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  c.isActive ? 'translate-x-3.5' : 'translate-x-0'
                                }`}
                              />
                            </button>

                            <button
                              onClick={() => openEditModal(c)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Edit coupon"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteCoupon(c)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Delete coupon"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Create / Edit Coupon Modal ─── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-white border border-slate-200 p-6 rounded-2xl shadow-2xl z-10 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Tag className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCoupon} className="space-y-4">
                {/* Code & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="coupon-code">Coupon Code *</Label>
                    <Input
                      id="coupon-code"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder="e.g. LAUNCH50"
                      disabled={!!editingCoupon}
                      className="font-mono uppercase font-bold"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="coupon-desc">Internal Description</Label>
                    <Input
                      id="coupon-desc"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="e.g. Creator VIP discount"
                    />
                  </div>
                </div>

                {/* Discount Type Toggle */}
                <div className="space-y-1">
                  <Label>Discount Type</Label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormDiscountType('PERCENTAGE')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        formDiscountType === 'PERCENTAGE'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5 text-primary" />
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDiscountType('FIXED_AMOUNT')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        formDiscountType === 'FIXED_AMOUNT'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>₹</span>
                      Fixed Amount (₹)
                    </button>
                  </div>
                </div>

                {/* Discount Value & Max Cap */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="coupon-val">
                      {formDiscountType === 'PERCENTAGE'
                        ? 'Discount Percentage (%) *'
                        : 'Discount Amount (₹) *'}
                    </Label>
                    <Input
                      id="coupon-val"
                      type="number"
                      min={1}
                      max={formDiscountType === 'PERCENTAGE' ? 100 : 100000}
                      value={formDiscountValue}
                      onChange={(e) => setFormDiscountValue(e.target.value)}
                      required
                    />
                  </div>

                  {formDiscountType === 'PERCENTAGE' ? (
                    <div className="space-y-1">
                      <Label htmlFor="coupon-cap">Max Discount Cap (₹)</Label>
                      <Input
                        id="coupon-cap"
                        type="number"
                        min={1}
                        value={formMaxDiscountRupees}
                        onChange={(e) => setFormMaxDiscountRupees(e.target.value)}
                        placeholder="Optional cap in ₹"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label htmlFor="coupon-min">Min Order Amount (₹)</Label>
                      <Input
                        id="coupon-min"
                        type="number"
                        min={0}
                        value={formMinOrderRupees}
                        onChange={(e) => setFormMinOrderRupees(e.target.value)}
                        placeholder="Optional min order"
                      />
                    </div>
                  )}
                </div>

                {/* Limits: Global & Per User */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="coupon-max-redemptions">Global Usage Cap</Label>
                    <Input
                      id="coupon-max-redemptions"
                      type="number"
                      min={1}
                      value={formMaxRedemptions}
                      onChange={(e) => setFormMaxRedemptions(e.target.value)}
                      placeholder="Empty = Unlimited"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="coupon-per-user">Max Uses Per Creator</Label>
                    <Input
                      id="coupon-per-user"
                      type="number"
                      min={1}
                      value={formMaxPerUser}
                      onChange={(e) => setFormMaxPerUser(e.target.value)}
                      placeholder="1"
                      required
                    />
                  </div>
                </div>

                {/* Applicable Plans & Cycles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Applicable Plans
                    </span>
                    <div className="flex items-center gap-3">
                      {['PRO', 'ENTERPRISE'].map((plan) => (
                        <label
                          key={plan}
                          className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formPlans.includes(plan)}
                            onChange={(e) => {
                              if (e.target.checked) setFormPlans([...formPlans, plan]);
                              else setFormPlans(formPlans.filter((p) => p !== plan));
                            }}
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          {plan === 'ENTERPRISE' ? 'Agency' : 'Pro'}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Billing Cycles
                    </span>
                    <div className="flex items-center gap-3">
                      {['MONTHLY', 'YEARLY'].map((cycle) => (
                        <label
                          key={cycle}
                          className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formCycles.includes(cycle)}
                            onChange={(e) => {
                              if (e.target.checked) setFormCycles([...formCycles, cycle]);
                              else setFormCycles(formCycles.filter((c) => c !== cycle));
                            }}
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          {cycle === 'YEARLY' ? 'Annual' : 'Monthly'}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expiration Date & Active switch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <Label htmlFor="coupon-expiry">Expiration Date</Label>
                    <Input
                      id="coupon-expiry"
                      type="date"
                      value={formExpiresAt}
                      onChange={(e) => setFormExpiresAt(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white sm:mt-5">
                    <span className="text-xs font-bold text-slate-800">Coupon Active</span>
                    <button
                      type="button"
                      onClick={() => setFormIsActive(!formIsActive)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formIsActive ? 'bg-primary' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          formIsActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSaving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                  >
                    {modalSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {editingCoupon ? 'Save Changes' : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Redemptions Audit Modal ─── */}
      <AnimatePresence>
        {viewingRedemptionsCoupon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              onClick={() => setViewingRedemptionsCoupon(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-white border border-slate-200 p-6 rounded-2xl shadow-2xl z-10 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Redemptions: {viewingRedemptionsCoupon.code}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Audit log of creators who applied this coupon at checkout.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingRedemptionsCoupon(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {redemptionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : redemptions.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No redemptions recorded for this coupon yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 font-bold">
                        <th className="py-2.5 px-3">Creator</th>
                        <th className="py-2.5 px-3">Discount Given</th>
                        <th className="py-2.5 px-3">Order Paid</th>
                        <th className="py-2.5 px-3 text-right">Redeemed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {redemptions.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 block">
                              {r.user?.name || 'Creator'}
                            </span>
                            <span className="text-[10px] text-slate-500">{r.user?.email}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-700">
                            -₹{(r.discountPaise / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            ₹{(r.orderAmountPaise / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 text-[10px]">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
