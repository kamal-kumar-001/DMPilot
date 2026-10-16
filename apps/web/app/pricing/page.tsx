'use client';

import * as React from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { AmbientBackground } from '@/components/landing/AmbientBackground';
import { motion } from 'framer-motion';
import { Check, X, Flame, Star, Zap } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api-client';
import { PricingPromoResponse, BillingPlan, ComparisonCategory } from '@/types';
import { DEFAULT_PRICING_DATA, LAUNCH_SPECIAL_STATS } from '@/lib/pricing-data';

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = React.useState<PricingPromoResponse>(DEFAULT_PRICING_DATA);
  const [isAnnual, setIsAnnual] = React.useState(true);

  React.useEffect(() => {
    fetch(API_BASE_URL + '/pricing-promo')
      .then((res) => res.json())
      .then((resJson) => {
        if (resJson && resJson.success && resJson.data) {
          setData(resJson.data);
        }
      })
      .catch((err) =>
        console.error('Failed to load pricing configurations, using fallback data:', err),
      );
  }, []);

  const handleSelectPlan = (planKey: string) => {
    if (planKey === 'ENTERPRISE') {
      router.push('/contact?subject=Agency');
      return;
    }
    if (planKey === 'FREE') {
      if (session?.user) {
        router.push('/automations');
      } else {
        router.push('/register');
      }
      return;
    }
    const cycle = isAnnual ? 'YEARLY' : 'MONTHLY';
    const checkoutUrl = `/checkout?plan=${planKey}&cycle=${cycle}`;
    if (session?.user) {
      router.push(checkoutUrl);
    } else {
      router.push(`/login?callbackUrl=${encodeURIComponent(checkoutUrl)}`);
    }
  };

  // Helpers for formatting plan limits
  const formatLimit = (val: number, singular: string, plural: string) => {
    if (val === -1) return 'Unlimited';
    return `${val.toLocaleString()} ${val === 1 ? singular : plural}`;
  };

  const getPrice = (plan: BillingPlan) => {
    if (plan.key === 'ENTERPRISE') return null;
    if (plan.key === 'FREE') return 0;
    return isAnnual ? Math.round((plan.priceYearly || 9990) / 12) : plan.priceMonthly || 999;
  };

  // Compute annual savings percentage
  const getAnnualSavings = (plan: BillingPlan) => {
    if (plan.priceMonthly <= 0 || plan.priceYearly <= 0) return 0;
    const annualIfMonthly = plan.priceMonthly * 12;
    return Math.round(((annualIfMonthly - plan.priceYearly) / annualIfMonthly) * 100);
  };

  // Build plan-specific feature highlights from limits
  const getPlanFeatures = (plan: BillingPlan): string[] => {
    const features: string[] = [];
    if (plan.key === 'ENTERPRISE') {
      features.push('5 to 50+ Client Accounts Managed');
      features.push('Custom Multi-Seat Team Workspace');
      features.push('All Pro Features Included');
      features.push('Dedicated Infrastructure & High SLA');
      features.push('Dedicated Account Manager & Priority Support');
    } else {
      features.push(`${formatLimit(plan.dmLimitMonthly, 'DM', 'DMs')} / month`);
      features.push(`${formatLimit(plan.campaignLimit, 'Campaign', 'Campaigns')}`);
      features.push('Hinglish & 10+ Regional Languages');
      features.push('Smart Reply Desk AI Query Filter');
      if (plan.key === 'PRO') {
        features.push('Anti-Spam Copy Variation Rotation');
        features.push('Redis Surge-Paced Queue Protection');
        features.push('Real-Time Mobile PWA Push Alerts');
        features.push('Voice Funnel Speech-to-Automation');
      }
    }
    return features;
  };

  const plans = data.plans || [];
  const promo = data.promo;
  const comparisonMatrix = data.comparisonMatrix || [];

  // Find plans by key for rendering
  const freePlan = plans.find((p) => p.key === 'FREE');
  const proPlan = plans.find((p) => p.key === 'PRO');
  const agencyPlan = plans.find((p) => p.key === 'ENTERPRISE');
  const orderedPlans = [freePlan, proPlan, agencyPlan].filter(Boolean) as BillingPlan[];

  return (
    <div className="bg-[#FAF9F5] min-h-screen text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden relative">
      {/* Full-Page Ambient Background Grid & Gradient */}
      <AmbientBackground />

      <div className="relative z-10">
        <Navbar />

        {/* Hero & Pricing Header */}
        <section className="pt-32 pb-8 text-center max-w-4xl mx-auto px-6 space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold tracking-widest text-emerald-800 uppercase inline-block shadow-sm">
            Transparent Creator Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Built for Creators, D2C Brands & Agencies <br />
            <span className="bg-gradient-to-r from-primary via-emerald-600 to-accent-cyan bg-clip-text text-transparent">
              Scale Without Account Limits
            </span>
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            No hidden setup fees. Upgrade or cancel anytime. Backed by our Meta Compliance
            Guarantee.
          </p>

          {/* Billing Switcher Toggle */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <span
              className={
                !isAnnual
                  ? 'text-slate-900 text-xs font-bold uppercase'
                  : 'text-slate-500 text-xs font-bold uppercase'
              }
            >
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border border-slate-300 bg-slate-200 transition-colors duration-200 ease-in-out focus:outline-none"
            >
              <span
                className={
                  isAnnual
                    ? 'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-gradient-to-r from-primary to-accent-cyan shadow transition duration-200 ease-in-out translate-x-5'
                    : 'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out translate-x-0'
                }
              />
            </button>
            <span
              className={
                isAnnual
                  ? 'text-primary text-xs font-bold uppercase flex items-center gap-1.5'
                  : 'text-slate-500 text-xs font-bold uppercase flex items-center gap-1.5'
              }
            >
              Annual Billed Yearly
              {proPlan && getAnnualSavings(proPlan) > 0 && (
                <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">
                  Save ~{getAnnualSavings(proPlan)}%
                </span>
              )}
            </span>
          </div>
        </section>

        {/* PRICING CARDS GRID */}
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {orderedPlans.map((plan) => {
              const price = getPrice(plan);
              const isAgency = plan.key === 'ENTERPRISE';
              const isPro = plan.key === 'PRO';
              const isFree = plan.key === 'FREE';
              const features = getPlanFeatures(plan);

              return (
                <motion.div
                  key={plan.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: isFree ? 0 : isPro ? 0.1 : 0.2 }}
                  className={`rounded-3xl p-7 relative flex flex-col justify-between space-y-6 transition-all hover:translate-y-[-4px] shadow-sm hover:shadow-lg ${
                    isPro
                      ? 'border-2 border-primary shadow-md transform scale-[1.02] ring-4 ring-emerald-50 bg-gradient-to-b from-white via-white to-emerald-50/50'
                      : 'border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/70'
                  }`}
                >
                  {/* "Most Popular" badge for Pro */}
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-accent-cyan text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                      MOST POPULAR CREATOR CHOICE
                    </div>
                  )}

                  <div className={`space-y-5 ${isPro ? 'pt-2' : ''}`}>
                    {/* Plan Name */}
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{plan.name || plan.key}</h3>
                      <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                    </div>

                    {/* Pricing Display */}
                    {isAgency ? (
                      <div className="space-y-1">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                          Contact Us
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Custom enterprise pricing & SLA terms
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-baseline space-x-1">
                          <span className="text-4xl font-extrabold text-slate-900">
                            {price === 0 ? '₹0' : `₹${price?.toLocaleString('en-IN')}`}
                          </span>
                          <span className="text-xs text-slate-500 font-bold">/ month</span>
                        </div>
                        {!isFree && isAnnual && plan.priceYearly > 0 ? (
                          <p className="text-[11px] font-bold text-primary font-mono">
                            billed annually (₹{plan.priceYearly.toLocaleString('en-IN')}/year
                            {getAnnualSavings(plan) > 0 ? ` • Save ${getAnnualSavings(plan)}%` : ''}
                            )
                          </p>
                        ) : !isFree ? (
                          <p className="text-[11px] text-slate-500 font-mono">billed monthly</p>
                        ) : null}
                      </div>
                    )}

                    {/* Whitelabel badge */}
                    <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 flex items-center gap-2">
                      <Star className="w-4 h-4 text-primary fill-current flex-shrink-0" />
                      <span>No DMPilot Branding (Whitelabel DMs)</span>
                    </div>

                    {/* Features List */}
                    <div className="border-t border-slate-100 pt-5 space-y-3 text-xs text-slate-700">
                      {features.map((feature, idx) => (
                        <div key={idx} className="flex items-center space-x-2.5">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          <span
                            dangerouslySetInnerHTML={{
                              __html: feature.replace(/^(Unlimited|[\d,]+)/, '<strong>$1</strong>'),
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  {isAgency ? (
                    <Link
                      href="/contact?subject=Agency"
                      className="w-full py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 font-bold text-center text-xs transition-all block"
                    >
                      Contact Us
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.key)}
                      className={`w-full rounded-xl font-bold text-center text-xs transition-all block cursor-pointer ${
                        isPro
                          ? 'py-4 bg-gradient-to-r from-primary to-accent-cyan text-white shadow-brand hover:shadow-brand-lg'
                          : isFree
                            ? 'py-3.5 border-2 border-primary/50 hover:border-primary bg-primary/10 hover:bg-primary/20 text-primary font-black shadow-sm'
                            : 'py-3.5 bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                      }`}
                    >
                      {isFree ? 'Start Free Account' : 'Get Started Pro'}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* COMPARISON SPECIFICATIONS MATRIX */}
        {comparisonMatrix.length > 0 && (
          <section className="max-w-5xl mx-auto px-6 py-16 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Feature Comparison Matrix
              </h2>
              <p className="text-xs text-slate-500">Detailed specs across all plan tiers</p>
            </div>

            <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md">
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
                      <th className="p-4">Features</th>
                      <th className="p-4 text-center">Free</th>
                      <th className="p-4 text-center text-primary font-black">Pro</th>
                      <th className="p-4 text-center">Agency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {comparisonMatrix.flatMap((cat: ComparisonCategory) => [
                      <tr key={cat.category} className="bg-slate-50/70">
                        <td
                          colSpan={4}
                          className="p-3 text-[10px] font-black uppercase text-primary tracking-widest pl-4"
                        >
                          {cat.category}
                        </td>
                      </tr>,
                      ...cat.features.map((feat, idx) => (
                        <tr
                          key={`${cat.category}-${idx}`}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="p-4 font-semibold text-slate-900">{feat.name}</td>
                          <td className="p-4 text-center font-mono">
                            {typeof feat.free === 'boolean' ? (
                              feat.free ? (
                                <Check className="w-4 h-4 text-primary mx-auto" />
                              ) : (
                                <X className="w-4 h-4 text-slate-300 mx-auto" />
                              )
                            ) : (
                              feat.free
                            )}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-primary">
                            {typeof feat.pro === 'boolean' ? (
                              feat.pro ? (
                                <Check className="w-4 h-4 text-primary mx-auto" />
                              ) : (
                                <X className="w-4 h-4 text-slate-300 mx-auto" />
                              )
                            ) : (
                              feat.pro
                            )}
                          </td>
                          <td className="p-4 text-center font-mono">
                            {typeof feat.agency === 'boolean' ? (
                              feat.agency ? (
                                <Check className="w-4 h-4 text-primary mx-auto" />
                              ) : (
                                <X className="w-4 h-4 text-slate-300 mx-auto" />
                              )
                            ) : (
                              feat.agency
                            )}
                          </td>
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="sm:hidden divide-y divide-slate-100">
                {comparisonMatrix.map((cat: ComparisonCategory) => (
                  <div key={cat.category}>
                    <div className="p-3 text-[10px] font-black uppercase text-primary tracking-widest bg-slate-50">
                      {cat.category}
                    </div>
                    {cat.features.map((feat, idx) => (
                      <div
                        key={idx}
                        className="p-4 space-y-2 border-b border-slate-100 last:border-b-0"
                      >
                        <p className="text-xs font-semibold text-slate-900">{feat.name}</p>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="text-center">
                            <span className="text-slate-400 block mb-0.5">Free</span>
                            <span className="text-slate-700 font-mono">
                              {typeof feat.free === 'boolean' ? (
                                feat.free ? (
                                  <Check className="w-3.5 h-3.5 text-primary mx-auto" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                                )
                              ) : (
                                feat.free
                              )}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-primary block mb-0.5 font-bold">Pro</span>
                            <span className="text-primary font-mono font-bold">
                              {typeof feat.pro === 'boolean' ? (
                                feat.pro ? (
                                  <Check className="w-3.5 h-3.5 text-primary mx-auto" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                                )
                              ) : (
                                feat.pro
                              )}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-400 block mb-0.5">Agency</span>
                            <span className="text-slate-700 font-mono">
                              {typeof feat.agency === 'boolean' ? (
                                feat.agency ? (
                                  <Check className="w-3.5 h-3.5 text-primary mx-auto" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                                )
                              ) : (
                                feat.agency
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <Footer />
      </div>
    </div>
  );
}
