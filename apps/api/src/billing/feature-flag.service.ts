import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan } from '@prisma/client';

// Default feature flags seeded at startup (all enabled for all plans in Meta App Review mode)
const DEFAULT_FLAGS: Array<{ key: string; description: string; enabledForPlans: string }> = [
  {
    key: 'NO_BRANDING',
    description: '✨ No DMPilot Branding (included for every plan, not a paid gate)',
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
    key: 'STORY_REPLY_TO_DM',
    description: 'Story reply/mention auto-reply automation',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'SHARE_TO_DM',
    description: 'Share-to-DM (Reel & Post) automation',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
  },
  {
    key: 'COMMENT_REPLY',
    description: 'Public comment auto-reply (no DM)',
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

/**
 * Flags that are part of every plan and are NOT a paid entitlement.
 * No DMPilot branding is ever added to outgoing DMs, so NO_BRANDING cannot be
 * locked, disabled or restricted per plan from admin.
 */
export const ALWAYS_INCLUDED_FLAGS = ['NO_BRANDING'] as const;
export function isAlwaysIncludedFlag(key: string): boolean {
  return (ALWAYS_INCLUDED_FLAGS as readonly string[]).includes(key);
}

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
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return flags.map((f) => ({ ...f, alwaysIncluded: isAlwaysIncludedFlag(f.key) }));
  }

  /** Check if a feature is enabled for a given plan. */
  async isEnabled(key: string, plan: Plan): Promise<boolean> {
    if (isAlwaysIncludedFlag(key)) return true;
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return false;
    return this.enabledForPlan(flag, plan);
  }

  enabledForPlan(flag: { key: string; isEnabled: boolean; enabledForPlans: string }, plan: Plan): boolean {
    if (isAlwaysIncludedFlag(flag.key)) return true;
    if (!flag.isEnabled) return false;
    const allowedPlans = flag.enabledForPlans.split(',').map((p) => p.trim());
    return allowedPlans.includes(plan) || allowedPlans.includes('ALL');
  }

  /** Throw a plan-upgrade ForbiddenException unless the flag is enabled for the plan. */
  async assertEnabled(key: string, plan: Plan): Promise<void> {
    const enabled = await this.isEnabled(key, plan);
    if (!enabled) {
      throw new ForbiddenException(
        `${key} is not included in your current plan (${plan}). Upgrade your plan to unlock it.`,
      );
    }
  }

  /** Toggle global kill-switch for a flag (admin). */
  async toggle(key: string, isEnabled: boolean) {
    this.assertEditable(key);
    return this.prisma.featureFlag.update({ where: { key }, data: { isEnabled } });
  }

  /** Update which plans have access to a flag (admin). */
  async updatePlans(key: string, plans: Plan[]) {
    this.assertEditable(key);
    return this.prisma.featureFlag.update({
      where: { key },
      data: { enabledForPlans: plans.join(',') },
    });
  }

  private assertEditable(key: string) {
    if (isAlwaysIncludedFlag(key)) {
      throw new BadRequestException(
        `${key} is included for every plan (DMPilot never adds branding to DMs) and cannot be restricted.`,
      );
    }
  }
}
