import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { GetUser } from './auth/decorators/get-user.decorator';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getIndex() {
    return {
      name: 'DMPilot API',
      version: '1.0.0',
      status: 'healthy',
    };
  }

  @Get('health')
  checkHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }

  @Get('pricing-promo')
  async getPricingPromo() {
    const plans = await this.prisma.billingPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });

    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['promo_banner_text', 'promo_banner_enabled', 'promo_discount_percent'],
        },
      },
    });

    const settingsMap = settings.reduce(
      (acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const featureFlags = await this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });

    // Build plan lookup for limits
    const planMap: Record<string, any> = {};
    for (const p of plans) {
      planMap[p.key] = p;
    }

    // Helper to format limit values for the comparison matrix
    const formatLimit = (val: number, suffix: string) =>
      val === -1 ? '∞ Unlimited' : `${val.toLocaleString()} ${suffix}`;

    // Helper to check if a flag is enabled for a plan
    const flagEnabledFor = (flag: any, planKey: string) =>
      flag.isEnabled &&
      flag.enabledForPlans
        .split(',')
        .map((s: string) => s.trim())
        .includes(planKey);

    // Build dynamic comparison matrix from DB data
    const comparisonMatrix = [
      {
        category: 'Core Capabilities',
        features: [
          {
            name: '✨ No DMPilot Branding (Whitelabel DMs)',
            free: 'Included',
            pro: 'Included',
            agency: 'Included',
          },
          {
            name: 'Active Automation Campaigns',
            free: formatLimit(planMap['FREE']?.campaignLimit ?? -1, 'Campaign(s)'),
            pro: formatLimit(planMap['PRO']?.campaignLimit ?? -1, 'Campaigns'),
            agency: formatLimit(planMap['ENTERPRISE']?.campaignLimit ?? -1, 'Campaigns'),
          },
          {
            name: 'Monthly DM Volume',
            free: formatLimit(planMap['FREE']?.dmLimitMonthly ?? -1, 'DMs/mo'),
            pro: formatLimit(planMap['PRO']?.dmLimitMonthly ?? -1, 'DMs/mo'),
            agency: formatLimit(planMap['ENTERPRISE']?.dmLimitMonthly ?? -1, 'DMs/mo'),
          },
          {
            name: 'Keywords Per Campaign',
            free: formatLimit(planMap['FREE']?.keywordLimit ?? -1, 'Keywords'),
            pro: formatLimit(planMap['PRO']?.keywordLimit ?? -1, 'Keywords'),
            agency: formatLimit(planMap['ENTERPRISE']?.keywordLimit ?? -1, 'Keywords'),
          },
        ],
      },
      {
        category: 'Smart Engines',
        features: featureFlags
          .filter((f) =>
            [
              'REPLY_DESK',
              'MULTILINGUAL_HINGLISH',
              'DM_VARIANTS',
              'VIRAL_QUEUE',
              'SPIKE_ALERTS',
              'VOICE_CREATE',
              'FOLLOW_CHECK_GATE',
            ].includes(f.key),
          )
          .map((f) => ({
            name: f.description || f.key,
            free: flagEnabledFor(f, 'FREE'),
            pro: flagEnabledFor(f, 'PRO'),
            agency: flagEnabledFor(f, 'ENTERPRISE'),
          })),
      },
      {
        category: 'Account & Management',
        features: [
          {
            name: 'Connected Instagram Accounts',
            free: '1 Account',
            pro: '3 Accounts',
            agency: 'Custom (5-50+)',
          },
          { name: 'Team Seats', free: '1 Seat', pro: '1 Seat', agency: 'Custom Team Workspace' },
          { name: 'Dedicated Account Manager', free: false, pro: false, agency: true },
        ],
      },
    ];

    return {
      plans: plans.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description || '',
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        campaignLimit: p.campaignLimit,
        keywordLimit: p.keywordLimit,
        dmLimitMonthly: p.dmLimitMonthly,
      })),
      promo: {
        text: settingsMap['promo_banner_text'] || '',
        enabled: settingsMap['promo_banner_enabled'] === 'true',
        discountPercent: parseInt(settingsMap['promo_discount_percent'] || '0', 10),
      },
      featureFlags,
      comparisonMatrix,
    };
  }

  @Post('support/tickets')
  @UseGuards(JwtAuthGuard)
  async createSupportTicket(
    @GetUser() user: { id: string },
    @Body() body: { subject: string; message: string },
  ) {
    return this.prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: body.subject,
        message: body.message,
      },
    });
  }
}
