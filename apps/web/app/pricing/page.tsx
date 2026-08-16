'use client';

import * as React from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
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
    <div className="bg-[#030712] min-h-screen text-white antialiased selection:bg-primary/30 selection:text-white overflow-x-hidden">
      {/* Background Mesh Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent-cyan/5 blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Navbar />

        {/* Hero & Pricing Header */}
        <section className="pt-32 pb-6 text-center max-w-4xl mx-auto px-6 space-y-4">
          <span className="px-3.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-black tracking-widest text-primary uppercase inline-block">
            Transparent Creator Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Built for Creators, D2C Brands & Agencies <br />
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-accent-cyan bg-clip-text text-transparent">
              Scale Without Account Limits
            </span>
          </h1>
          <p className="text-sm text-gray-400 max-w-xl mx-auto">
            No hidden setup fees. Upgrade or cancel anytime. Backed by our Meta Compliance
            Guarantee.
          </p>

          {/* Launch Special Progress Bar Banner — shows if promo is enabled */}
          {promo?.enabled && promo.discountPercent > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto my-8 p-5 rounded-2xl bg-gradient-to-r from-primary/15 via-emerald-500/20 to-accent-cyan/15 border border-primary/30 shadow-[0_0_30px_rgba(0,187,136,0.15)] text-center space-y-3"
            >
              <div className="flex items-center justify-center gap-2">
                <Flame className="w-5 h-5 text-amber-400 animate-bounce flex-shrink-0" />
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  {promo.discountPercent === 100
                    ? `Special Launch Offer: 100% OFF for First ${LAUNCH_SPECIAL_STATS.total} Users!`
                    : `Special Launch Offer: ${promo.discountPercent}% OFF!`}
                </h3>
              </div>
              <p className="text-xs text-gray-300">
                {promo.text ||
                  `Get ${promo.discountPercent}% free access to all core automation features.`}
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-primary">
                    {LAUNCH_SPECIAL_STATS.claimed} / {LAUNCH_SPECIAL_STATS.total} Spots Claimed
                  </span>
                  <span className="text-amber-300">
                    {LAUNCH_SPECIAL_STATS.remaining} Spots Remaining
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-white/10">
                  <div className="bg-gradient-to-r from-primary via-emerald-400 to-accent-cyan h-full w-[84%] rounded-full shadow-[0_0_10px_rgba(0,187,136,0.5)] transition-all duration-1000" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Billing Switcher Toggle */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <span
              className={
                !isAnnual
                  ? 'text-white text-xs font-bold uppercase'
                  : 'text-gray-500 text-xs font-bold uppercase'
              }
            >
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-white/10 transition-colors duration-200 ease-in-out focus:outline-none"
            >
              <span
                className={
                  isAnnual
                    ? 'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-primary shadow transition duration-200 ease-in-out translate-x-5'
                    : 'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-primary shadow transition duration-200 ease-in-out translate-x-0'
                }
              />
            </button>
            <span
              className={
                isAnnual
                  ? 'text-primary text-xs font-bold uppercase flex items-center gap-1.5'
                  : 'text-gray-500 text-xs font-bold uppercase flex items-center gap-1.5'
              }
            >
              Annual Billed Yearly
              {proPlan && getAnnualSavings(proPlan) > 0 && (
                <span className="text-[9px] bg-primary/20 border border-primary/30 text-primary px-2 py-0.5 rounded font-black uppercase animate-pulse">
                  Save ~{getAnnualSavings(proPlan)}%
                </span>
              )}
            </span>
          </div>
        </section>

        {/* PRICING CARDS GRID — Fully Dynamic from API */}
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
                  className={`glass-card rounded-3xl p-7 shadow-glass relative flex flex-col justify-between space-y-6 transition-transform hover:translate-y-[-4px] ${
                    isPro
                      ? 'border-2 border-primary shadow-[0_0_35px_rgba(0,187,136,0.2)] transform scale-[1.02] bg-gradient-to-b from-primary/10 via-transparent to-transparent'
                      : 'border-gradient'
                  }`}
                >
                  {/* "Most Popular" badge for Pro */}
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-accent-cyan text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                      MOST POPULAR CREATOR CHOICE
                    </div>
                  )}

                  <div className={`space-y-5 ${isPro ? 'pt-2' : ''}`}>
                    {/* Plan Name */}
                    <div>
                      <h3 className="text-xl font-black text-white">{plan.name || plan.key}</h3>
                      <p className="text-xs text-gray-400 mt-1">{plan.description}</p>
                    </div>

                    {/* Pricing Display */}
                    {isAgency ? (
                      <div className="space-y-1">
                        <div className="text-3xl font-black text-white tracking-tight">
                          Contact Us
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Custom enterprise pricing & SLA terms
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-baseline space-x-1">
                          <span className="text-4xl font-black text-white">
                            {price === 0 ? '₹0' : `₹${price?.toLocaleString('en-IN')}`}
                          </span>
                          <span className="text-xs text-gray-400 font-bold">/ month</span>
                        </div>
                        {!isFree && isAnnual && plan.priceYearly > 0 ? (
                          <p className="text-[11px] font-bold text-primary font-mono">
                            billed annually (₹{plan.priceYearly.toLocaleString('en-IN')}/year
                            {getAnnualSavings(plan) > 0 ? ` • Save ${getAnnualSavings(plan)}%` : ''}
                            )
                          </p>
                        ) : !isFree ? (
                          <p className="text-[11px] text-gray-500 font-mono">billed monthly</p>
                        ) : null}
                      </div>
                    )}

                    {/* Whitelabel badge */}
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                        isPro
                          ? 'bg-primary/20 border-primary/40 text-primary'
                          : 'bg-primary/10 border-primary/25 text-primary'
                      }`}
                    >
                      <Star className="w-4 h-4 text-primary fill-current flex-shrink-0" />
                      <span>No DMPilot Branding (Whitelabel DMs)</span>
                    </div>

                    {/* Features List — built dynamically from plan data */}
                    <div
                      className={`border-t border-white/5 pt-5 space-y-3 text-xs ${
                        isPro ? 'text-gray-200 font-medium' : 'text-gray-300'
                      }`}
                    >
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
                      className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-center text-xs transition-all block"
                    >
                      Contact Us
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.key)}
                      className={`w-full rounded-xl font-bold text-center text-xs transition-all block cursor-pointer ${
                        isPro
                          ? 'py-4 bg-gradient-to-r from-primary to-accent-cyan text-white shadow-lg hover:shadow-xl transform hover:scale-[1.01]'
                          : 'py-3.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white'
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

        {/* COMPARISON SPECIFICATIONS MATRIX — Dynamic from API */}
        {comparisonMatrix.length > 0 && (
          <section className="max-w-5xl mx-auto px-6 py-16 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Feature Comparison Matrix
              </h2>
              <p className="text-xs text-gray-400">Detailed specs across all plan tiers</p>
            </div>

            <div className="glass-card border-gradient rounded-3xl overflow-hidden shadow-2xl">
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-gray-300 font-bold uppercase tracking-wider">
                      <th className="p-4">Features</th>
                      <th className="p-4 text-center">Free</th>
                      <th className="p-4 text-center text-primary">Pro</th>
                      <th className="p-4 text-center">Agency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {comparisonMatrix.flatMap((cat: ComparisonCategory) => [
                      <tr key={cat.category} className="bg-white/[0.02]">
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
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4 font-semibold text-white">{feat.name}</td>
                          <td className="p-4 text-center font-mono">
                            {typeof feat.free === 'boolean' ? (
                              feat.free ? (
                                <Check className="w-4 h-4 text-primary mx-auto" />
                              ) : (
                                <X className="w-4 h-4 text-gray-600 mx-auto" />
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
                                <X className="w-4 h-4 text-gray-600 mx-auto" />
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
                                <X className="w-4 h-4 text-gray-600 mx-auto" />
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
              <div className="sm:hidden divide-y divide-white/5">
                {comparisonMatrix.map((cat: ComparisonCategory) => (
                  <div key={cat.category}>
                    <div className="p-3 text-[10px] font-black uppercase text-primary tracking-widest bg-white/[0.02]">
                      {cat.category}
                    </div>
                    {cat.features.map((feat, idx) => (
                      <div
                        key={idx}
                        className="p-4 space-y-2 border-b border-white/5 last:border-b-0"
                      >
                        <p className="text-xs font-semibold text-white">{feat.name}</p>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="text-center">
                            <span className="text-gray-500 block mb-0.5">Free</span>
                            <span className="text-gray-300 font-mono">
                              {typeof feat.free === 'boolean' ? (
                                feat.free ? (
                                  <Check className="w-3.5 h-3.5 text-primary mx-auto" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-gray-600 mx-auto" />
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
                                  <X className="w-3.5 h-3.5 text-gray-600 mx-auto" />
                                )
                              ) : (
                                feat.pro
                              )}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-gray-500 block mb-0.5">Agency</span>
                            <span className="text-gray-300 font-mono">
                              {typeof feat.agency === 'boolean' ? (
                                feat.agency ? (
                                  <Check className="w-3.5 h-3.5 text-primary mx-auto" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-gray-600 mx-auto" />
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
