'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button, Label, toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { clearDraftIfVerified, readCheckoutPending } from '@/lib/checkout-draft';
import { CustomSelect } from '@/components/ui/custom-select';

const USAGE_LABELS: Record<string, string> = {
  max_campaigns: 'Active campaigns',
  max_accounts: 'Instagram accounts',
  max_dms_per_month: 'DMs this month',
  max_keywords: 'Keywords per campaign',
};

export function SettingsBilling() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const [plans, setPlans] = React.useState<any[]>([]);
  const paidPlanForDiscount =
    plans.find((p: any) => p.key === 'PRO' && p.priceMonthly > 0 && p.priceYearly > 0) ||
    plans.find((p: any) => p.priceMonthly > 0 && p.priceYearly > 0);
  const yearlyDiscountPct = paidPlanForDiscount
    ? Math.max(
        0,
        Math.round(
          (1 - paidPlanForDiscount.priceYearly / 12 / paidPlanForDiscount.priceMonthly) * 100,
        ),
      )
    : null;
  const [subscription, setSubscription] = React.useState<any>(null);
  const [usage, setUsage] = React.useState<any>(null);
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAnnual, setIsAnnual] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelFeedback, setCancelFeedback] = React.useState('');

  const fetchData = async () => {
    try {
      const [plansData, subData, usageData, invoiceData] = await Promise.all([
        apiRequest<any[]>('/billing/plans'),
        apiRequest<any>('/billing/subscription'),
        apiRequest<any>('/billing/usage'),
        apiRequest<any[]>('/billing/invoices').catch(() => []),
      ]);
      setPlans(plansData || []);
      setSubscription(subData);
      queryClient.setQueryData(['creator', session?.user?.id, '/billing/subscription'], subData);
      // Payment is confirmed only when the API says the account is on a paid plan.
      setUsage(usageData);
      setInvoices(invoiceData || []);

      if (subData?.plan && subData.plan !== session?.user?.plan) {
        updateSession({
          user: {
            ...session?.user,
            plan: subData.plan,
          },
        }).catch(() => null);
      }
    } catch (e) {
      console.error('Failed to load billing metrics', e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  // The saved checkout form is cleared only when a NEW paid invoice for the checkout started in
  // this browser appears (the server writes it from the verified payment). The ?payment=success
  // URL and an already-paid plan do not count. Pending checkouts get at most six refreshes.
  React.useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !readCheckoutPending(uid)) return;
    if (clearDraftIfVerified(uid, invoices)) return;
    // FeeFree can intentionally have no return redirect. A locally pending checkout
    // also permits a short authoritative refresh when the creator opens Billing.
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (tries > 6 || !readCheckoutPending(uid)) {
        clearInterval(t);
        return;
      }
      void fetchData();
      apiRequest<any[]>('/billing/invoices')
        .then((inv) => {
          if (clearDraftIfVerified(uid, inv)) clearInterval(t);
        })
        .catch(() => null);
    }, 5000);
    return () => clearInterval(t);
  }, [session?.user?.id]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Checkout submitted. Your plan updates once access is confirmed.', {
        id: 'billing-upgrade-toast',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('payment') === 'cancel') {
      toast.error('Payment checkout session was cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleUpgrade = (planKey: string) => {
    if (planKey === 'ENTERPRISE' || planKey === 'AGENCY') {
      window.location.href = '/contact?subject=Agency';
      return;
    }
    // Downgrade to FREE is not a checkout: the free plan has no price, so the
    // checkout page could only show a dead-end error. Downgrading means
    // cancelling auto-renewal and reverting to FREE at period end.
    if (planKey === 'FREE') {
      setShowCancelModal(true);
      return;
    }
    const cycle = isAnnual ? 'YEARLY' : 'MONTHLY';
    window.location.href = `/checkout?plan=${planKey}&cycle=${cycle}`;
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      await apiRequest('/billing/cancel', {
        method: 'POST',
        body: JSON.stringify({
          reason: cancelReason,
          feedback: cancelFeedback,
        }),
      });
      toast.success(
        'Subscription cancelled. Your access will remain active until the end of your billing cycle.',
      );
      setShowCancelModal(false);
      fetchData();
    } catch (e) {
      toast.error('Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const [receiptBusy, setReceiptBusy] = React.useState<string | null>(null);
  const handleDownloadReceipt = async (invoice: any) => {
    if (invoice.status !== 'PAID' || receiptBusy) return;
    setReceiptBusy(invoice.id);
    try {
      // Recheck owner and paid status at the authoritative receipt endpoint.
      const confirmed = await apiRequest<any>(
        `/billing/invoices/${encodeURIComponent(invoice.id)}/receipt`,
      );
      if (confirmed.status !== 'PAID') throw new Error('Payment not confirmed');
      const { createReceiptPdf } = await import('@/lib/receipt-pdf');
      const bytes = await createReceiptPdf(confirmed);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `DMPilot-receipt-${String(confirmed.id).replace(/[^a-zA-Z0-9-]/g, '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success('Payment receipt downloaded');
    } catch {
      toast.error('Receipt unavailable. Payment must be confirmed as paid.');
    } finally {
      setReceiptBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-2">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
        <p className="text-xs text-gray-500">Loading plan subscription parameters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan metrics banner */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm animate-in fade-in duration-200">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Current Tier
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700">
              {subscription?.plan || 'FREE'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600">
              {subscription?.cycle || 'MONTHLY'}
            </span>
          </div>
          <h4 className="text-sm font-extrabold text-slate-900">
            {subscription?.plan === 'FREE'
              ? 'Free Trial Subscription'
              : `${subscription?.plan} Creator Plan Active`}
          </h4>
          {subscription?.expiresAt && (
            <p className="text-[9px] text-slate-500">
              {new Date(subscription.expiresAt).getTime() < Date.now() ? (
                <>
                  Expired on:{' '}
                  <strong className="text-red-600">
                    {new Date(subscription.expiresAt).toLocaleDateString()}
                  </strong>
                </>
              ) : (
                <>
                  Renews / expires on:{' '}
                  <strong className="text-slate-800">
                    {new Date(subscription.expiresAt).toLocaleDateString()}
                  </strong>
                </>
              )}
            </p>
          )}
        </div>

        {/* Usage stats bars */}
        {usage?.usage && (
          <div className="space-y-3 min-w-[200px]">
            {usage.usage.map((u: any) => (
              <div key={u.metric} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600 capitalize">
                    {USAGE_LABELS[u.metric] || u.metric.replace(/^max_/, '').replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-500 font-medium">
                    {u.used} / {u.unlimited || u.limit === -1 ? 'Unlimited' : u.limit}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent-cyan transition-all duration-300"
                    style={{ width: `${u.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly / Annual Cycle Toggle */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl border border-slate-200/80 p-3 rounded-2xl shadow-sm">
        <div>
          <h5 className="text-xs font-bold text-slate-900">Choose Billing Cycle</h5>
          <p className="text-[10px] text-slate-500">
            {yearlyDiscountPct
              ? `Save ${yearlyDiscountPct}% on annual subscriptions with instant activation`
              : 'Save on annual subscriptions with instant activation'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !isAnnual ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              isAnnual ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Annual
            <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-emerald-200">
              {yearlyDiscountPct ? `Save ${yearlyDiscountPct}%` : 'Best value'}
            </span>
          </button>
        </div>
      </div>

      {/* Plans selector grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
        {plans.map((plan: any) => {
          const planKey = plan.key;
          const isCurrent = planKey === subscription?.plan;
          const isAgency =
            planKey === 'ENTERPRISE' || planKey === 'AGENCY' || plan.label === 'Agency';

          return (
            <div
              key={planKey}
              className={`bg-white border border-slate-200/80 relative p-6 rounded-2xl flex flex-col justify-between h-full shadow-sm hover:shadow-md transition-all ${
                isCurrent ? 'ring-2 ring-emerald-500/40 border-emerald-400' : ''
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 right-5 bg-gradient-to-r from-primary to-accent-cyan text-primary-foreground text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full shadow-md">
                  Popular
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-slate-900">{plan.name || planKey}</h4>
                  <p className="text-[10px] text-slate-500 leading-normal min-h-[30px]">
                    {plan.description}
                  </p>
                </div>

                {/* Pricing Display */}
                {isAgency ? (
                  <div className="space-y-0.5">
                    <div className="text-2xl font-extrabold text-slate-900">Contact Us</div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Custom enterprise pricing
                    </p>
                  </div>
                ) : planKey === 'FREE' ? (
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-extrabold text-slate-900">₹0</span>
                    <span className="text-[10px] text-slate-500">/month</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-extrabold text-slate-900">
                        {isAnnual
                          ? plan.priceYearly > 0
                            ? `₹${Math.round(plan.priceYearly / 12).toLocaleString('en-IN')}`
                            : '—'
                          : plan.priceMonthly > 0
                            ? `₹${plan.priceMonthly.toLocaleString('en-IN')}`
                            : '—'}
                      </span>
                      <span className="text-[10px] text-slate-500">/month</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-[10px] text-emerald-700 font-mono font-bold">
                        billed annually (₹{(plan.priceYearly || 0).toLocaleString('en-IN')}/yr)
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-mono">billed monthly</p>
                    )}
                  </div>
                )}

                <ul className="space-y-2 text-[10px] text-slate-600 border-t border-slate-100 pt-4">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>
                      {plan.campaignLimit === -1
                        ? 'Unlimited active campaigns'
                        : `${plan.campaignLimit} active campaign${plan.campaignLimit === 1 ? '' : 's'}`}
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>
                      {plan.dmLimitMonthly === -1
                        ? 'Unlimited DMs per month'
                        : `${plan.dmLimitMonthly.toLocaleString()} DMs per month`}
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>
                      {plan.keywordLimit === -1
                        ? 'Unlimited keywords per campaign'
                        : `${plan.keywordLimit} keyword${plan.keywordLimit === 1 ? '' : 's'} per campaign`}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-5 border-t border-slate-100 mt-5">
                <Button
                  onClick={() => handleUpgrade(planKey)}
                  disabled={isCurrent}
                  className={`w-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                      : planKey === 'FREE'
                        ? 'border border-slate-300 !bg-white hover:!bg-slate-50 !text-slate-700 cursor-pointer shadow-sm'
                        : isAgency
                          ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-sm'
                          : 'bg-gradient-to-r from-primary to-accent-cyan hover:opacity-95 text-white border-0 shadow-brand hover:shadow-brand-lg cursor-pointer'
                  }`}
                >
                  {isCurrent
                    ? 'Active Plan'
                    : planKey === 'FREE'
                      ? 'Downgrade to Free'
                      : isAgency
                        ? 'Contact Agency Sales'
                        : 'Select Plan'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoice History & Receipt Section */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Invoice History & Receipts</h4>
            <p className="text-[10px] text-slate-500">Download receipts for confirmed payments</p>
          </div>
          {subscription?.plan !== 'FREE' && subscription?.accessSource !== 'EMAIL_OBSERVED' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                disabled={cancelling}
                className="text-[10px] border-rose-200 text-rose-600 hover:bg-rose-50 h-7"
              >
                Cancel Auto-Renewal
              </Button>
            </>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No payment receipts found yet. Subscriptions will generate receipts here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice ID</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {inv.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {inv.plan} ({inv.cycle})
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${inv.status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDownloadReceipt(inv)}
                        disabled={inv.status !== 'PAID' || Boolean(receiptBusy)}
                        title={
                          inv.status === 'PAID'
                            ? 'Download PDF receipt'
                            : 'Available after payment is confirmed'
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10px] font-semibold text-emerald-700 transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {receiptBusy === inv.id
                          ? 'Downloading...'
                          : inv.status === 'PAID'
                            ? 'Download PDF'
                            : 'Awaiting payment'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancellation Feedback Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCancelModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl z-10 space-y-4 font-sans relative animate-in fade-in duration-200"
            >
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Cancel Subscription Auto-Renewal
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  We are sad to see you go. Please let us know why you are cancelling your
                  auto-renewal. Your premium access will remain active until the end of your current
                  billing period.
                </p>
              </div>

              {/* Cancellation reason CustomSelect */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <Label htmlFor="cancel-reason" className="text-slate-800">
                  Reason for cancelling
                </Label>
                <CustomSelect
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(val) => setCancelReason(val)}
                  placeholder="Select a reason..."
                  options={[
                    { value: 'Too Expensive', label: 'Pricing is too high' },
                    { value: 'Missing Features', label: 'Missing key features' },
                    { value: 'Alternative Found', label: 'Switched to another product' },
                    { value: 'Technical Issues', label: 'Too many bugs / difficult setup' },
                    { value: 'Other', label: 'Other reason' },
                  ]}
                />
              </div>

              {/* Feedback text area */}
              <div className="space-y-1.5">
                <Label htmlFor="cancel-feedback" className="text-slate-800">
                  Any additional feedback? (Optional)
                </Label>
                <textarea
                  id="cancel-feedback"
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="Tell us how we can improve DMPilot..."
                  className="w-full h-20 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  Keep Subscription
                </Button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={cancelling || !cancelReason}
                  className="h-9 px-4 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
