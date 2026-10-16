'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ShieldCheck,
  Lock,
  CreditCard,
  ArrowLeft,
  Check,
  Sparkles,
  Loader2,
  Building2,
} from 'lucide-react';
import { toast } from '@autodm/ui';
import { apiRequest, API_BASE_URL } from '@/lib/api-client';

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const planKey = (searchParams.get('plan') || 'PRO').toUpperCase();
  const initialCycle = (
    searchParams.get('billing') ||
    searchParams.get('cycle') ||
    'MONTHLY'
  ).toUpperCase();

  const [cycle, setCycle] = React.useState<'MONTHLY' | 'YEARLY'>(
    initialCycle === 'YEARLY' || initialCycle === 'ANNUALLY' ? 'YEARLY' : 'MONTHLY',
  );
  const [loading, setLoading] = React.useState(false);
  const [promoDiscount, setPromoDiscount] = React.useState(0);
  const [promoText, setPromoText] = React.useState('');
  const [plansData, setPlansData] = React.useState<any[]>([]);
  const currentPlan = plansData.find((p: any) => p.key === planKey);

  // Fetch promotions config from public endpoint
  React.useEffect(() => {
    fetch(`${API_BASE_URL}/pricing-promo`)
      .then((res) => res.json())
      .then((resJson) => {
        if (resJson && resJson.success && resJson.data && resJson.data.promo) {
          setPromoDiscount(resJson.data.promo.discountPercent || 0);
          setPromoText(resJson.data.promo.text || '');
        }
        if (resJson && resJson.success && resJson.data) {
          setPlansData(resJson.data.plans || []);
        }
      })
      .catch((err) => console.error('Failed to load promotions config on checkout page', err));
  }, []);

  // Form State
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    gstin: '',
    acceptConsent: false,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Auto-fill from session
  React.useEffect(() => {
    if (session?.user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || session.user?.name || '',
        email: prev.email || session.user?.email || '',
      }));
    }
  }, [session]);

  const planInfo = currentPlan
    ? {
        name: currentPlan.name || planKey,
        monthly: currentPlan.priceMonthly || 999,
        yearly: currentPlan.priceYearly || 9990,
        features: [
          'Unlimited Story & Comment Auto-DMs',
          'Advanced Personalization ({name}, {username})',
          'Public Comment Auto-Replies',
          'Live Activity & Campaign Analytics',
          'Priority Webhook Dispatch',
        ],
      }
    : {
        name: planKey === 'ENTERPRISE' ? 'Agency' : 'Pro Creator',
        monthly: planKey === 'ENTERPRISE' ? 4999 : 999,
        yearly: planKey === 'ENTERPRISE' ? 49990 : 9990,
        features: [
          'Unlimited Story & Comment Auto-DMs',
          'Advanced Personalization ({name}, {username})',
          'Public Comment Auto-Replies',
          'Live Activity & Campaign Analytics',
          'Priority Webhook Dispatch',
        ],
      };
  const originalPrice = cycle === 'YEARLY' ? planInfo.yearly : planInfo.monthly;
  const basePrice = Math.round(originalPrice * (1 - promoDiscount / 100));
  const tax = Math.round(basePrice * 0.18);
  const totalAmount = basePrice + tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session) {
      toast.error('Please sign in or create an account to proceed with checkout.');
      router.push(`/register?redirect=/checkout?plan=${planKey}&cycle=${cycle}`);
      return;
    }

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Full Name / Company is required';
    if (!formData.email.trim()) newErrors.email = 'Billing Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.address.trim()) newErrors.address = 'Street Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
    if (!formData.acceptConsent)
      newErrors.acceptConsent =
        'You must accept processing of address data under India DPDP Act 2023';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please resolve the errors on the billing form.');
      return;
    }
    setErrors({});

    setLoading(true);

    try {
      const res = await apiRequest<{ url: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan: planKey,
          cycle,
          billingDetails: formData,
        }),
      });

      if (res?.url) {
        toast.success('Redirecting to Razorpay Secure Gateway...');
        window.location.href = res.url;
      } else {
        toast.error('Failed to initialize checkout link. Please try again.');
        setLoading(false);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to initialize payment gateway.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-200/80">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Lock className="w-3.5 h-3.5 text-primary" />
            256-Bit SSL Encrypted Checkout
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Billing Details Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Complete your <span className="text-primary">{planInfo.name}</span> subscription
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                Enter your billing details to activate your account and start sending automated DMs
                instantly.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Account & Billing Contact
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setErrors({ ...errors, name: '' });
                      }}
                      placeholder="Kamal"
                      className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors ${
                        errors.name
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-slate-200 focus:border-primary'
                      }`}
                    />
                    {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        setErrors({ ...errors, email: '' });
                      }}
                      placeholder="support@dmpilot.org"
                      className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors ${
                        errors.email
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-slate-200 focus:border-primary'
                      }`}
                    />
                    {errors.email && (
                      <p className="text-[10px] text-red-500 mt-1">{errors.email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number (For WhatsApp / SMS Receipts) *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      setErrors({ ...errors, phone: '' });
                    }}
                    placeholder="+91 98765 43210"
                    className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      errors.phone
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-slate-200 focus:border-primary'
                    }`}
                  />
                  {errors.phone && <p className="text-[10px] text-red-500 mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      setErrors({ ...errors, address: '' });
                    }}
                    placeholder="Suite 402, Creator Hub Tower"
                    className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      errors.address
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-slate-200 focus:border-primary'
                    }`}
                  />
                  {errors.address && (
                    <p className="text-[10px] text-red-500 mt-1">{errors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => {
                        setFormData({ ...formData, city: e.target.value });
                        setErrors({ ...errors, city: '' });
                      }}
                      placeholder="Mumbai"
                      className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors ${
                        errors.city
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-slate-200 focus:border-primary'
                      }`}
                    />
                    {errors.city && <p className="text-[10px] text-red-500 mt-1">{errors.city}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      State / Province
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="Maharashtra"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pincode *
                    </label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => {
                        setFormData({ ...formData, pincode: e.target.value });
                        setErrors({ ...errors, pincode: '' });
                      }}
                      placeholder="400001"
                      className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors ${
                        errors.pincode
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-slate-200 focus:border-primary'
                      }`}
                    />
                    {errors.pincode && (
                      <p className="text-[10px] text-red-500 mt-1">{errors.pincode}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GSTIN Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) =>
                        setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                      }
                      placeholder="27AAAAA0000A1Z5"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                {/* Mandatory DPDP Act 2023 & Privacy Consent Checkbox */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100">
                  <div className="flex items-start gap-2.5">
                    <input
                      id="checkoutConsent"
                      type="checkbox"
                      checked={formData.acceptConsent}
                      onChange={(e) => {
                        setFormData({ ...formData, acceptConsent: e.target.checked });
                        setErrors({ ...errors, acceptConsent: '' });
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                    />
                    <label
                      htmlFor="checkoutConsent"
                      className="text-[11px] text-slate-600 leading-relaxed cursor-pointer select-none"
                    >
                      I consent to the processing of my address, phone, and billing details for
                      order fulfillment, GST invoicing, and account setup under India DPDP Act 2023
                      &{' '}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-primary hover:underline font-bold"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </label>
                  </div>
                  {errors.acceptConsent && (
                    <p className="text-[10px] text-red-500 mt-1">{errors.acceptConsent}</p>
                  )}
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading || !formData.acceptConsent}
                className="w-full py-4 text-center rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-primary via-accent-purple to-accent-cyan shadow-lg hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initializing Razorpay Secure Gateway...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pay ₹{totalAmount.toLocaleString('en-IN')} with Razorpay
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-6 pt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Instant Activation
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-accent-cyan" />
                  Razorpay SSL Verified
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Cancel Anytime
                </span>
              </div>
            </form>
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-6 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{planInfo.name}</h3>
                  <p className="text-xs text-slate-500">Automated DM & Comment Growth Platform</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                  {planKey}
                </span>
              </div>

              {/* Cycle Toggle inside Order Summary */}
              <div className="bg-slate-100 border border-slate-200/80 p-1.5 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCycle('MONTHLY')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    cycle === 'MONTHLY'
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('YEARLY')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                    cycle === 'YEARLY'
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Annual Billing
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                    Save 20%
                  </span>
                </button>
              </div>

              {/* Line Items */}
              <div className="space-y-3 border-b border-slate-100 pb-4 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Original Plan Price ({cycle === 'YEARLY' ? '12 Months' : '1 Month'})</span>
                  <span className="font-semibold text-slate-800">
                    ₹{originalPrice.toLocaleString('en-IN')}
                  </span>
                </div>

                {cycle === 'YEARLY' && (
                  <div className="flex justify-between text-emerald-700 text-[11px] font-semibold">
                    <span>Annual Billing Discount</span>
                    <span>-20% Included</span>
                  </div>
                )}

                {promoDiscount > 0 && (
                  <div className="flex justify-between text-primary text-[11px] font-bold">
                    <span>Promotional Discount ({promoDiscount}% Off)</span>
                    <span>-₹{(originalPrice - basePrice).toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-800 font-bold border-t border-slate-100 pt-2">
                  <span>Subtotal</span>
                  <span>₹{basePrice.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Estimated Tax (18% GST)</span>
                  <span>₹{tax.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Total Price Display */}
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-sm font-bold text-slate-700">Total Payable Now:</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Billed {cycle === 'YEARLY' ? 'annually' : 'monthly'}. Inclusive of all taxes.
                  </p>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Plan Highlights:
                </p>
                {planInfo.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5 text-xs text-slate-700">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
