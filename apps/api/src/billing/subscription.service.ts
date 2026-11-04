import { NotificationService } from '../notification/notification.service';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, SubscriptionStatus, BillingCycle } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { FeeFreeService } from './feefree.service';

// ─── Fallback plan limits (used only if BillingPlan DB table is empty) ────────
// These are the safety defaults — the real values come from the database
// which is controlled via the Admin Panel → Billing Plans.
export const FALLBACK_PLAN_LIMITS: Record<Plan, Record<string, number>> = {
  FREE: {
    max_campaigns: -1,
    max_accounts: -1,
    max_dms_per_month: -1,
    max_keywords: -1,
  },
  PRO: {
    max_campaigns: -1,
    max_accounts: -1,
    max_dms_per_month: -1,
    max_keywords: -1,
  },
  ENTERPRISE: {
    max_campaigns: -1,
    max_accounts: -1,
    max_dms_per_month: -1,
    max_keywords: -1,
  },
};

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly feeFreeService: FeeFreeService,
    private readonly notifications: NotificationService,
  ) {}

  /** Get or auto-create a FREE subscription for a user, enforcing expiration checks. */
  async getOrCreate(userId: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing) {
      // Check if subscription period has expired
      if (
        existing.expiresAt &&
        existing.expiresAt < new Date() &&
        existing.plan !== Plan.FREE &&
        existing.status !== SubscriptionStatus.EXPIRED
      ) {
        console.log(
          `[Subscription Service] Subscription for user ${userId} expired on ${existing.expiresAt.toISOString()}. Reverting to FREE tier.`,
        );
        const expired = await this.prisma.subscription.update({
          where: { userId },
          data: {
            plan: Plan.FREE,
            status: SubscriptionStatus.EXPIRED,
          },
        });
        await this.notifications.notifyOnce(
          userId,
          `subscription-expired:${existing.id}:${existing.expiresAt.toISOString()}`,
          'Your paid plan has expired',
          'Your workspace is now on Free. Review Billing in Settings to restore paid features.',
          'WARNING',
        );
        return expired;
      }
      return existing;
    }

    return this.prisma.subscription.create({
      data: {
        userId,
        plan: Plan.FREE,
        status: SubscriptionStatus.TRIAL,
        trialEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
      },
    });
  }

  /** Return plan limits for a user's current plan — reads from BillingPlan DB (Admin Panel controlled). */
  async getLimits(userId: string) {
    const sub = await this.getOrCreate(userId);

    // Read limits from the BillingPlan DB table (set via Admin Panel → Billing Plans)
    const planConfig = await this.prisma.billingPlan.findUnique({ where: { key: sub.plan } });

    const limits = planConfig
      ? {
          max_campaigns: planConfig.campaignLimit,
          max_keywords: planConfig.keywordLimit,
          max_dms_per_month: planConfig.dmLimitMonthly,
          max_accounts: planConfig.accountLimit ?? -1,
        }
      : FALLBACK_PLAN_LIMITS[sub.plan] || FALLBACK_PLAN_LIMITS.FREE;

    return { subscription: sub, limits };
  }

  /** Check whether a user is within a specific usage limit. Only DELIVERED messages count toward DM quota. */
  async checkLimit(
    userId: string,
    metric: string,
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const { limits } = await this.getLimits(userId);
    const limit = (limits as Record<string, number>)[metric] ?? -1;
    if (limit === -1 || limit < 0) return { allowed: true, used: 0, limit: -1 };

    let used = 0;
    if (metric === 'max_campaigns') {
      used = await this.prisma.campaign.count({ where: { userId, deletedAt: null } });
    } else if (metric === 'max_dms_per_month') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      used = await this.prisma.message.count({
        where: {
          instagramAccount: { userId },
          status: { in: ['DELIVERED', 'SENT'] },
          createdAt: { gte: startOfMonth },
        },
      });
    } else if (metric === 'max_accounts') {
      used = await this.prisma.instagramAccount.count({ where: { userId } });
    } else {
      const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const record = await this.prisma.usageRecord.findUnique({
        where: { userId_metric_period: { userId, metric, period } },
      });
      used = record?.value ?? 0;
    }

    return { allowed: used < limit, used, limit };
  }

  /** Increment a usage metric for the current billing period. */
  async incrementUsage(userId: string, metric: string, by = 1) {
    const period = new Date().toISOString().slice(0, 7);
    await this.prisma.usageRecord.upsert({
      where: { userId_metric_period: { userId, metric, period } },
      create: { userId, metric, period, value: by },
      update: { value: { increment: by } },
    });
  }

  /** Get all plans with metadata — returns raw DB values for the frontend to render. */
  async getPlans() {
    const dbPlans = await this.prisma.billingPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });

    if (dbPlans.length === 0) {
      // Fallback if DB is empty (should not happen after seed)
      return [
        {
          key: 'FREE',
          name: 'Free',
          description: 'Get started with basic automation.',
          priceMonthly: 0,
          priceYearly: 0,
          campaignLimit: -1,
          keywordLimit: -1,
          dmLimitMonthly: -1,
          highlight: false,
        },
        {
          key: 'PRO',
          name: 'Pro',
          description: 'For serious creators scaling their reach.',
          priceMonthly: 999,
          priceYearly: 9990,
          campaignLimit: -1,
          keywordLimit: -1,
          dmLimitMonthly: -1,
          highlight: true,
        },
        {
          key: 'ENTERPRISE',
          name: 'Agency',
          description: 'Unlimited scale for agencies & brands.',
          priceMonthly: 0,
          priceYearly: 0,
          campaignLimit: -1,
          keywordLimit: -1,
          dmLimitMonthly: -1,
          highlight: false,
        },
      ];
    }

    return dbPlans.map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description || '',
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      campaignLimit: p.campaignLimit,
      keywordLimit: p.keywordLimit,
      dmLimitMonthly: p.dmLimitMonthly,
      accountLimit: p.accountLimit,
      highlight: p.key === 'PRO',
    }));
  }

  /**
   * Upgrade/downgrade a plan.
   * Real payment flow: call Razorpay, confirm webhook, THEN call this.
   */
  /** Configured paid price in paise-free rupees. Zero or missing config is a real misconfiguration, never a silent default. */
  private requireConfiguredPrice(
    planConfig: { priceMonthly?: number | null; priceYearly?: number | null } | null | undefined,
    cycle: BillingCycle,
  ): number {
    const price =
      cycle === BillingCycle.YEARLY ? planConfig?.priceYearly : planConfig?.priceMonthly;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      throw new BadRequestException(
        'This plan has no valid configured price. Set it in admin before checkout.',
      );
    }
    return price;
  }

  /** Look up the server-generated invoice id for a payment id this service just recorded. */
  private async invoiceRefForPayment(
    userId: string,
    paymentId: string,
  ): Promise<string | undefined> {
    const inv = await this.prisma.invoice.findFirst({
      where: { userId, paymentId },
      select: { id: true },
    });
    return inv?.id;
  }

  async changePlan(
    userId: string,
    plan: Plan,
    cycle: BillingCycle = BillingCycle.MONTHLY,
    paymentId?: string,
    paymentLinkId?: string,
    billingDetails?: any,
    existingInvoiceId?: string,
    invoiceBaseOverride?: number,
  ) {
    // Prevent duplicate processing if invoice for paymentId already exists
    if (paymentId) {
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: { paymentId },
      });
      if (existingInvoice) {
        return this.prisma.subscription.findUnique({ where: { userId } });
      }
    }

    // Fail before any plan is granted when a paid plan has no valid configured price.
    if (plan !== Plan.FREE && !existingInvoiceId && typeof invoiceBaseOverride !== 'number') {
      const cfg = await this.prisma.billingPlan.findUnique({ where: { key: plan } });
      this.requireConfiguredPrice(cfg, cycle);
    }

    const daysToAdd = cycle === BillingCycle.YEARLY ? 365 : 30;
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        cycle,
        expiresAt,
        cancelAtPeriodEnd: false,
        externalId: paymentLinkId || null,
        billingAddress: billingDetails || undefined,
      },
      update: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        cycle,
        expiresAt,
        cancelAtPeriodEnd: false,
        externalId: paymentLinkId || null,
        billingAddress: billingDetails || undefined,
      },
    });

    if (plan !== Plan.FREE) {
      const planConfig = await this.prisma.billingPlan.findUnique({ where: { key: plan } });
      const basePrice =
        typeof invoiceBaseOverride === 'number'
          ? invoiceBaseOverride
          : existingInvoiceId
            ? 0
            : this.requireConfiguredPrice(planConfig, cycle);
      const totalAmountWithTax = Math.round(basePrice * 1.18);

      if (existingInvoiceId) {
        // FeeFree flow: the PENDING invoice was created at checkout time; mark it paid.
        await this.prisma.invoice.update({
          where: { id: existingInvoiceId },
          data: {
            status: 'PAID',
            paymentId: paymentId || null,
            paymentLinkId: paymentLinkId || null,
          },
        });
      } else {
        await this.prisma.invoice.create({
          data: {
            userId,
            amount: totalAmountWithTax,
            currency: 'INR',
            plan,
            cycle,
            status: 'PAID',
            paymentId: paymentId || null,
            paymentLinkId: paymentLinkId || null,
            billingDetails: billingDetails || undefined,
          },
        });
      }
    }

    if (plan !== Plan.FREE && paymentId) {
      await this.notifications.notifyOnce(
        userId,
        `payment-confirmed:${paymentId}`,
        'Payment confirmed',
        `Your ${plan === Plan.ENTERPRISE ? 'Agency' : 'Pro'} plan is active. Your receipt is available in Settings > Billing.`,
        'SUCCESS',
      );
    }

    return subscription;
  }

  async seedPlansDefaults(): Promise<void> {
    try {
      const plansData = [
        {
          key: Plan.FREE,
          name: 'Free Creator',
          description: 'Get started with smart DM automation.',
          priceMonthly: 0,
          priceYearly: 0,
          campaignLimit: -1,
          keywordLimit: -1,
          dmLimitMonthly: -1,
          accountLimit: -1,
        },
        {
          key: Plan.PRO,
          name: 'Pro Creator',
          description: 'For serious creators scaling their reach.',
          priceMonthly: 999,
          priceYearly: 9990,
          campaignLimit: -1,
          keywordLimit: -1,
          dmLimitMonthly: -1,
          accountLimit: -1,
        },
        {
          key: Plan.ENTERPRISE,
          name: 'Agency Scale',
          description: 'Unlimited scale for agencies & brands.',
          priceMonthly: 0,
          priceYearly: 0,
          campaignLimit: -1,
          keywordLimit: -1,
          dmLimitMonthly: -1,
          accountLimit: -1,
        },
      ];

      for (const p of plansData) {
        await this.prisma.billingPlan.upsert({
          where: { key: p.key },
          create: p,
          update: {}, // Preserve custom admin pricing in database; never overwrite on build/restart
        });
      }
    } catch (e) {
      console.warn(
        'SubscriptionService seedPlansDefaults skipped:',
        e instanceof Error ? e.message : e,
      );
    }
  }

  async seedPromoDefaults(): Promise<void> {
    try {
      const defaults = [
        {
          key: 'promo_banner_text',
          value: 'Special launch discount! 30% off for the first 100 creators! Use code: LAUNCH30',
        },
        { key: 'promo_banner_enabled', value: 'false' },
        { key: 'promo_discount_percent', value: '30' },
      ];

      for (const d of defaults) {
        await this.prisma.systemSetting.upsert({
          where: { key: d.key },
          create: d,
          update: {}, // Only create default if it does not exist, do not overwrite custom values
        });
      }
    } catch (e) {
      console.warn(
        'SubscriptionService seedPromoDefaults skipped:',
        e instanceof Error ? e.message : e,
      );
    }
  }

  /** Get usage summary for current period. */
  async getUsageSummary(userId: string) {
    const period = new Date().toISOString().slice(0, 7);
    const { subscription, limits } = await this.getLimits(userId);

    const [records, accounts, campaigns, keywords] = await Promise.all([
      this.prisma.usageRecord.findMany({ where: { userId, period } }),
      this.prisma.instagramAccount.count({ where: { userId, isConnected: true, deletedAt: null } }),
      this.prisma.campaign.count({ where: { userId, deletedAt: null } }),
      this.prisma.keyword.count({ where: { campaign: { userId, deletedAt: null } } }),
    ]);
    const usageMap = Object.fromEntries(records.map((r) => [r.metric, r.value]));
    // Resource gauges come from live rows, not monthly increment counters.
    usageMap.max_accounts = accounts;
    usageMap.max_campaigns = campaigns;
    usageMap.max_keywords = keywords;

    return {
      plan: subscription.plan,
      status: subscription.status,
      period,
      usage: Object.entries(limits).map(([metric, limit]) => ({
        metric,
        used: usageMap[metric] ?? 0,
        limit,
        unlimited: limit === -1,
        percent:
          limit === -1 ? 0 : Math.min(100, Math.round(((usageMap[metric] ?? 0) / limit) * 100)),
      })),
    };
  }

  async createCheckoutSession(
    userId: string,
    plan: Plan,
    cycle: BillingCycle = BillingCycle.MONTHLY,
    billingDetails?: any,
  ) {
    const rawPlan = String(plan).toUpperCase();
    if (rawPlan === 'FREE') {
      throw new BadRequestException('Free plan does not require payment checkout.');
    }

    const normalizedCycle =
      String(cycle).toUpperCase() === 'YEARLY' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
    const normalizedPlan = rawPlan === 'ENTERPRISE' ? Plan.ENTERPRISE : Plan.PRO;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const planConfig = await this.prisma.billingPlan.findUnique({
      where: { key: normalizedPlan },
    });

    if (normalizedPlan === Plan.ENTERPRISE && (!planConfig || planConfig.priceMonthly <= 0)) {
      throw new BadRequestException(
        'Enterprise plan requires custom sales onboarding. Please contact sales.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const basePrice = this.requireConfiguredPrice(planConfig, normalizedCycle);

    // Fetch promotions discount config
    const promoEnabledSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'promo_banner_enabled' },
    });
    const promoDiscountSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'promo_discount_percent' },
    });

    const isPromoEnabled = promoEnabledSetting?.value === 'true';
    let promoDiscountPercent = isPromoEnabled
      ? parseInt(promoDiscountSetting?.value || '0', 10)
      : 0;

    // Clamp discount percentage between 0 and 100
    promoDiscountPercent = Math.max(0, Math.min(100, promoDiscountPercent));

    // Handle 100% discount promo - bypass payment entirely since Rs 0 charges fail
    if (promoDiscountPercent === 100) {
      const promoPaymentId = 'pay_promo_100_' + Date.now();
      await this.changePlan(
        userId,
        normalizedPlan,
        normalizedCycle,
        promoPaymentId,
        'plink_promo_100_' + Date.now(),
        billingDetails,
        undefined,
        0,
      );
      return {
        url: `${frontendUrl}/settings?payment=success`,
        checkoutRef: await this.invoiceRefForPayment(userId, promoPaymentId),
      };
    }

    const discountedBasePrice = Math.round(basePrice * (1 - promoDiscountPercent / 100));
    const totalAmountPaise = Math.round(discountedBasePrice * 1.18 * 100);

    if (billingDetails) {
      await this.prisma.subscription.upsert({
        where: { userId },
        create: { userId, plan: Plan.FREE, billingAddress: billingDetails },
        update: { billingAddress: billingDetails },
      });
    }

    const provider = (this.configService.get<string>('BILLING_PROVIDER') || 'razorpay')
      .toLowerCase()
      .trim();

    if (provider === 'feefree') {
      return this.createFeeFreeCheckout(
        userId,
        user,
        normalizedPlan,
        normalizedCycle,
        discountedBasePrice,
        totalAmountPaise,
        billingDetails,
        frontendUrl,
      );
    }

    // ─── Razorpay (default) ───
    const razorpayKeyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const razorpayKeySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    // Mock checkout self-grants a paid plan without payment: never honored in production.
    const allowMockCheckout =
      this.configService.get<string>('ALLOW_MOCK_CHECKOUT') === 'true' &&
      this.configService.get<string>('NODE_ENV') !== 'production';

    // If Razorpay keys are missing/placeholder AND mock checkout is explicitly allowed
    if (
      (!razorpayKeyId ||
        !razorpayKeySecret ||
        razorpayKeyId.includes('mock') ||
        razorpayKeyId.includes('placeholder')) &&
      allowMockCheckout
    ) {
      const mockPaymentId = 'pay_mock_' + Date.now();
      await this.changePlan(
        userId,
        normalizedPlan,
        normalizedCycle,
        mockPaymentId,
        'plink_mock_' + Date.now(),
        billingDetails,
      );
      return {
        url: `${frontendUrl}/settings?payment=success`,
        checkoutRef: await this.invoiceRefForPayment(userId, mockPaymentId),
      };
    }

    if (!razorpayKeyId || !razorpayKeySecret || razorpayKeyId.includes('placeholder')) {
      throw new BadRequestException('Razorpay payment gateway is not configured on the server.');
    }

    try {
      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      });

      const paymentLink = await razorpay.paymentLink.create({
        amount: totalAmountPaise,
        currency: 'INR',
        accept_partial: false,
        first_min_partial_amount: 0,
        description: `DMPilot ${normalizedPlan} Plan (${normalizedCycle}) - Automated Instagram Growth`,
        customer: {
          name: billingDetails?.name || user?.name || 'Creator',
          email: billingDetails?.email || user?.email || 'creator@dmpilot.org',
          contact: billingDetails?.phone || undefined,
        },
        notify: {
          sms: false,
          email: true,
        },
        reminder_enable: true,
        notes: {
          userId,
          plan: normalizedPlan,
          cycle: normalizedCycle,
          billingDetails: billingDetails ? JSON.stringify(billingDetails) : '',
        },
        callback_url: `${frontendUrl}/settings?payment=success`,
        callback_method: 'get',
      });

      return { url: paymentLink.short_url, checkoutRef: paymentLink.id };
    } catch (error: any) {
      console.error('Razorpay payment link creation error:', error);
      throw new BadRequestException(
        error?.error?.description ||
          error?.message ||
          'Failed to initialize Razorpay checkout gateway. Please verify billing details or try again later.',
      );
    }
  }

  /**
   * Record Razorpay refund.processed / payment.failed events for audit.
   * Non-destructive by design: no plan or invoice mutation. Automatically
   * downgrading on a refund is a policy decision for the owner (refunds can
   * be partial or disputed), so this only makes the event admin-visible.
   */
  async recordRazorpayAnomaly(event: any) {
    try {
      const paymentEntity = event?.payload?.payment?.entity || event?.payload?.refund?.entity || {};
      const paymentId = paymentEntity.payment_id || paymentEntity.id || null;
      const invoice = paymentId
        ? await this.prisma.invoice.findFirst({ where: { paymentId } })
        : null;
      await this.prisma.auditLog.create({
        data: {
          userId: invoice?.userId || null,
          action: event?.event === 'refund.processed' ? 'PAYMENT_REFUNDED' : 'PAYMENT_FAILED',
          details: JSON.stringify({
            event: event?.event,
            paymentId,
            refundId: event?.payload?.refund?.entity?.id || null,
            amount: paymentEntity.amount || null,
            invoiceId: invoice?.id || null,
          }),
        },
      });
    } catch (error) {
      console.error('Failed to record Razorpay refund/failure event:', error);
    }
  }

  /**
   * FeeFree (UPI) checkout. DMPilot derives user, plan and amount server-side,
   * creates a PENDING invoice, uses the invoice id as the FeeFree orderId, and
   * stores an exact session record the webhook must match before any upgrade.
   * The FeeFree API key is used server-to-server only.
   */
  private async createFeeFreeCheckout(
    userId: string,
    user: any,
    plan: Plan,
    cycle: BillingCycle,
    totalAmountRupees: number,
    totalAmountPaise: number,
    billingDetails: any,
    frontendUrl: string,
  ) {
    const invoice = await this.prisma.invoice.create({
      data: {
        userId,
        amount: totalAmountRupees,
        currency: 'INR',
        plan,
        cycle,
        status: 'PENDING',
        billingDetails: billingDetails || undefined,
      },
    });

    // FeeFree puts this order id in the UPI intent's `tr` field, which NPCI limits
    // to 35 characters; `dmp_inv_<uuid>` was 44 and strict UPI apps rejected it.
    const orderId = `dmp${invoice.id.replace(/-/g, '')}`;

    let session;
    try {
      session = await this.feeFreeService.createSession({
        orderId,
        amountPaise: totalAmountPaise,
        customerName: billingDetails?.name || user?.name || 'Creator',
        customerEmail: billingDetails?.email || user?.email || undefined,
        customerMobile: billingDetails?.phone || undefined,
        returnUrl: `${frontendUrl}/settings?payment=success`,
      });
    } catch (error) {
      // Do not leave an orphan pending invoice when the provider call fails.
      await this.prisma.invoice.delete({ where: { id: invoice.id } }).catch(() => null);
      throw error;
    }

    await this.prisma.paymentSession.create({
      data: {
        userId,
        provider: 'feefree',
        orderId,
        sessionId: session.id,
        invoiceId: invoice.id,
        plan,
        cycle,
        baseAmountPaise: totalAmountPaise,
        amountPaise:
          typeof session.expectedAmountPaise === 'number'
            ? session.expectedAmountPaise
            : totalAmountPaise,
        currency: 'INR',
        billingDetails: billingDetails || undefined,
        checkoutUrl: session.checkoutUrl,
        expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      },
    });

    // checkoutRef lets the browser match exactly this checkout to its paid invoice later.
    return { url: session.checkoutUrl, checkoutRef: invoice.id };
  }

  /**
   * FeeFree webhook fulfillment. The controller has already verified the HMAC
   * signature and timestamp freshness; here the event must match DMPilot's own
   * stored checkout session exactly (session id, order id, amount, currency),
   * pass bank-UTR dedupe, and be re-confirmed server-side with the FeeFree API
   * before the plan is upgraded. Browser callbacks never reach this path.
   */
  async fulfillFeeFreePayment(data: {
    orderId?: string;
    sessionId?: string;
    amountPaise?: number;
    baseAmountPaise?: number;
    discountPaise?: number;
    utr?: string;
    completedAt?: string;
  }) {
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
    const orderId = typeof data.orderId === 'string' ? data.orderId : '';
    const utr = typeof data.utr === 'string' ? data.utr.trim().toUpperCase() : '';

    if (!sessionId || !orderId || !utr) {
      throw new BadRequestException('Malformed FeeFree payment payload');
    }

    const paymentSession = await this.prisma.paymentSession.findUnique({
      where: { sessionId },
    });

    if (!paymentSession || paymentSession.orderId !== orderId) {
      throw new NotFoundException('Unknown FeeFree checkout session');
    }

    if (paymentSession.status === 'PAID') {
      return { received: true, deduped: true, orderId };
    }

    // Exact amount + currency match against the stored server-side record.
    if (paymentSession.currency !== 'INR') {
      throw new BadRequestException('Unexpected currency on stored checkout session');
    }
    if (
      typeof data.baseAmountPaise !== 'number' ||
      typeof data.amountPaise !== 'number' ||
      data.baseAmountPaise !== paymentSession.baseAmountPaise ||
      data.amountPaise !== paymentSession.amountPaise
    ) {
      throw new BadRequestException(
        'Amount mismatch between FeeFree webhook and stored checkout session',
      );
    }

    // Bank UTR dedupe: one real bank transaction can never fulfill two orders.
    const utrSessionClash = await this.prisma.paymentSession.findFirst({
      where: { utr, id: { not: paymentSession.id } },
    });
    if (utrSessionClash) {
      console.warn(`[FeeFree Webhook] UTR ${utr} already fulfilled another order - deduped.`);
      return { received: true, deduped: true, orderId };
    }
    const utrInvoiceClash = await this.prisma.invoice.findFirst({ where: { paymentId: utr } });
    if (utrInvoiceClash) {
      console.warn(`[FeeFree Webhook] UTR ${utr} already recorded on an invoice - deduped.`);
      return { received: true, deduped: true, orderId };
    }

    // Authoritative server-side re-confirmation with the FeeFree API. A signed
    // webhook proves the event came from FeeFree; this confirms the session
    // itself is marked SUCCESS. (Neither is bank-statement proof - manual
    // reconciliation remains available via the disputes desk.)
    const liveSession = await this.feeFreeService.getSession(sessionId);
    if (String(liveSession.status || '').toUpperCase() !== 'SUCCESS') {
      throw new BadRequestException('FeeFree session is not confirmed as paid');
    }
    if (liveSession.orderId && liveSession.orderId !== paymentSession.orderId) {
      throw new BadRequestException('FeeFree session order mismatch');
    }
    if (liveSession.utr && liveSession.utr.trim().toUpperCase() !== utr) {
      throw new BadRequestException('FeeFree session UTR mismatch');
    }

    await this.prisma.paymentSession.update({
      where: { id: paymentSession.id },
      data: { status: 'PAID', utr },
    });

    await this.changePlan(
      paymentSession.userId,
      paymentSession.plan,
      paymentSession.cycle,
      utr,
      sessionId,
      paymentSession.billingDetails,
      paymentSession.invoiceId || undefined,
    );

    return { received: true, orderId };
  }

  getInvoices(userId: string) {
    return this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceReceipt(userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status !== 'PAID')
      throw new BadRequestException('Receipt is only available after payment is confirmed.');
    return invoice;
  }

  async cancelSubscription(userId: string, body?: { reason?: string; feedback?: string }) {
    const reason = body?.reason || 'No reason provided';
    const feedback = body?.feedback || 'No comments';

    // Log to console for admin visibility
    console.log(
      `[Subscription Cancelled] User ${userId} cancelled. Reason: "${reason}", Feedback: "${feedback}"`,
    );

    // Create an audit log record
    await this.prisma.auditLog
      .create({
        data: {
          userId,
          action: 'SUBSCRIPTION_CANCELLATION_REQUESTED',
          details: `Reason: ${reason} | Feedback: ${feedback}`,
        },
      })
      .catch(() => null);

    // Create a warning notification for the user
    await this.prisma.notification
      .create({
        data: {
          userId,
          title: 'Auto-Renewal Cancelled ⚠️',
          message: `Your premium subscription auto-renewal was successfully cancelled. You will continue to have PRO access until the end of your billing cycle. Reason: "${reason}".`,
          type: 'WARNING',
        },
      })
      .catch(() => null);

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        status: SubscriptionStatus.CANCELLED,
      },
    });
  }
}
