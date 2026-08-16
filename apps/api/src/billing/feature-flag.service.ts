import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan } from '@prisma/client';

// Default feature flags seeded at startup (all enabled for all plans in Meta App Review mode)
const DEFAULT_FLAGS: Array<{ key: string; description: string; enabledForPlans: string }> = [
  {
    key: 'NO_BRANDING',
    description: '✨ No DMPilot Branding (Clean Whitelabel DMs)',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'REPLY_DESK',
    description: 'Smart Reply Desk AI Query Filter',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'MULTILINGUAL_HINGLISH',
    description: 'Hinglish & Regional Language Engine',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'COMMENT_TO_DM',
    description: 'Comment-triggered DM automation',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'KEYWORD_TO_DM',
    description: 'Keyword-triggered DM automation',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'WELCOME_DM',
    description: 'New follower welcome DM',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'DM_VARIANTS',
    description: 'Anti-Spam Copy Variation Rotation',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'VIRAL_QUEUE',
    description: 'Redis Surge-Paced Viral Queue Protection',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'SPIKE_ALERTS',
    description: 'Real-Time Mobile PWA Push Alerts',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'VOICE_CREATE',
    description: 'Voice Funnel Speech-to-Automation',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'FOLLOW_CHECK_GATE',
    description: 'Follow-to-Unlock Quick Reply Gate',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'ANALYTICS_ADVANCED',
    description: 'Advanced analytics dashboard',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'MULTI_ACCOUNT',
    description: 'Connect multiple Instagram accounts',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'WEBHOOK_LOGS',
    description: 'Access webhook event logs',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'EXPORT_DATA',
    description: 'Export analytics and message history',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'API_ACCESS',
    description: 'Direct REST API access',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'audit_logging',
    description: 'System-wide audit logging tracker',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'EMAIL_VERIFICATION_REQUIRED',
    description: 'Enforce email verification for campaign automation and account link actions',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
];

@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  /** Seed default flags (call on module init). */
  async seedDefaults() {
    try {
      for (const flag of DEFAULT_FLAGS) {
        await this.prisma.featureFlag.upsert({
          where: { key: flag.key },
          create: flag,
          update: {},
        });
      }
    } catch (e) {
      console.warn('FeatureFlagService seedDefaults skipped:', e instanceof Error ? e.message : e);
    }
  }

  /** Get all feature flags (admin view). */
  async getAll() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  /** Check if a feature is enabled for a given plan. */
  async isEnabled(key: string, plan: Plan): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return true;
    if (!flag.isEnabled) return false;
    const allowedPlans = flag.enabledForPlans.split(',').map((p) => p.trim());
    return (
      allowedPlans.includes(plan) || allowedPlans.includes('FREE') || allowedPlans.includes('ALL')
    );
  }

  /** Toggle global kill-switch for a flag (admin). */
  async toggle(key: string, isEnabled: boolean) {
    return this.prisma.featureFlag.update({ where: { key }, data: { isEnabled } });
  }

  /** Update which plans have access to a flag (admin). */
  async updatePlans(key: string, plans: Plan[]) {
    return this.prisma.featureFlag.update({
      where: { key },
      data: { enabledForPlans: plans.join(',') },
    });
  }
}
