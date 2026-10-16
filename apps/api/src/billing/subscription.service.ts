import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, SubscriptionStatus, BillingCycle } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

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
        return this.prisma.subscription.update({
          where: { userId },
          data: {
            plan: Plan.FREE,
            status: SubscriptionStatus.EXPIRED,
          },
        });
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
          max_accounts: -1, // accounts limit is not in BillingPlan schema yet, default unlimited
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
      highlight: p.key === 'PRO',
    }));
  }

  /**
   * Upgrade/downgrade a plan.
   * Real payment flow: call Razorpay, confirm webhook, THEN call this.
   */
  async changePlan(
    userId: string,
    plan: Plan,
    cycle: BillingCycle = BillingCycle.MONTHLY,
    paymentId?: string,
    paymentLinkId?: string,
    billingDetails?: any,
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
        cycle === BillingCycle.YEARLY
          ? planConfig?.priceYearly || (plan === Plan.PRO ? 9990 : 49990)
          : planConfig?.priceMonthly || (plan === Plan.PRO ? 999 : 4999);
      const totalAmountWithTax = Math.round(basePrice * 1.18);

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

    const records = await this.prisma.usageRecord.findMany({ where: { userId, period } });
    const usageMap = Object.fromEntries(records.map((r) => [r.metric, r.value]));

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

    const razorpayKeyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const razorpayKeySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    const allowMockCheckout = this.configService.get<string>('ALLOW_MOCK_CHECKOUT') === 'true';

    // If Razorpay keys are missing/placeholder AND mock checkout is explicitly allowed
    if (
      (!razorpayKeyId ||
        !razorpayKeySecret ||
        razorpayKeyId.includes('mock') ||
        razorpayKeyId.includes('placeholder')) &&
      allowMockCheckout
    ) {
      await this.changePlan(
        userId,
        normalizedPlan,
        normalizedCycle,
        'pay_mock_' + Date.now(),
        'plink_mock_' + Date.now(),
        billingDetails,
      );
      return { url: `${frontendUrl}/settings?payment=success` };
    }

    if (!razorpayKeyId || !razorpayKeySecret || razorpayKeyId.includes('placeholder')) {
      throw new BadRequestException('Razorpay payment gateway is not configured on the server.');
    }

    try {
      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      });

      const basePrice =
        normalizedCycle === BillingCycle.YEARLY
          ? planConfig?.priceYearly || (normalizedPlan === Plan.PRO ? 9990 : 49990)
          : planConfig?.priceMonthly || (normalizedPlan === Plan.PRO ? 999 : 4999);

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

      // Handle 100% discount promo — bypass Razorpay since ₹0 payment links fail
      if (promoDiscountPercent === 100) {
        await this.changePlan(
          userId,
          normalizedPlan,
          normalizedCycle,
          'pay_promo_100_' + Date.now(),
          'plink_promo_100_' + Date.now(),
          billingDetails,
        );
        return { url: `${frontendUrl}/settings?payment=success` };
      }

      const discountedBasePrice = Math.round(basePrice * (1 - promoDiscountPercent / 100));
      const totalAmountPaise = Math.round(discountedBasePrice * 1.18 * 100);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (billingDetails) {
        await this.prisma.subscription.upsert({
          where: { userId },
          create: { userId, plan: Plan.FREE, billingAddress: billingDetails },
          update: { billingAddress: billingDetails },
        });
      }

      const paymentLink = await razorpay.paymentLink.create({
        amount: totalAmountPaise,
        currency: 'INR',
        accept_partial: false,
        first_min_partial_amount: 0,
        description: `AutoDM ${normalizedPlan} Plan (${normalizedCycle}) - Automated Instagram Growth`,
        customer: {
          name: billingDetails?.name || user?.name || 'Creator',
          email: billingDetails?.email || user?.email || 'creator@autodm.com',
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

      return { url: paymentLink.short_url };
    } catch (error: any) {
      console.error('Razorpay payment link creation error:', error);
      throw new BadRequestException(
        error?.error?.description ||
          error?.message ||
          'Failed to initialize Razorpay checkout gateway. Please verify billing details or try again later.',
      );
    }
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
