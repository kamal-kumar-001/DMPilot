import {
  BillingPlan,
  FeatureFlag,
  PromoSettings,
  PricingPromoResponse,
  ComparisonCategory,
} from '@/types';

// ─── Fallback defaults (used only when API is unreachable) ────────────────────
// Real data comes from the database via GET /pricing-promo, controlled by Admin Panel.

export const DEFAULT_PLANS: BillingPlan[] = [
  {
    key: 'FREE',
    name: 'Free',
    description: 'Ideal for individual creators getting started with smart DM automation',
    priceMonthly: 0,
    priceYearly: 0,
    campaignLimit: -1,
    keywordLimit: -1,
    dmLimitMonthly: -1,
  },
  {
    key: 'PRO',
    name: 'Pro',
    description: 'Unlimited everything for serious creators & growing digital brands',
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
    description: 'Custom infrastructure & multi-seat workspace for agencies & big creators',
    priceMonthly: 0,
    priceYearly: 0,
    campaignLimit: -1,
    keywordLimit: -1,
    dmLimitMonthly: -1,
  },
];

export const DEFAULT_PROMO: PromoSettings = {
  text: '⚡ Special Launch Offer: 100% OFF for the First 100 Users! (84/100 claimed)',
  enabled: true,
  discountPercent: 100,
};

export const LAUNCH_SPECIAL_STATS = {
  claimed: 84,
  total: 100,
  remaining: 16,
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'flag-no-branding',
    key: 'NO_BRANDING',
    description: '✨ No DMPilot Branding (Clean Whitelabel DMs)',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
    isEnabled: true,
  },
  {
    id: 'flag-reply-desk',
    key: 'REPLY_DESK',
    description: 'Smart Reply Desk AI Query Filter',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
    isEnabled: true,
  },
  {
    id: 'flag-multilingual',
    key: 'MULTILINGUAL_HINGLISH',
    description: 'Hinglish & Regional Language Engine',
    enabledForPlans: 'FREE,PRO,ENTERPRISE',
    isEnabled: true,
  },
  {
    id: 'flag-dm-variants',
    key: 'DM_VARIANTS',
    description: 'Anti-Spam Copy Variation Rotation',
    enabledForPlans: 'PRO,ENTERPRISE',
    isEnabled: true,
  },
  {
    id: 'flag-viral-queue',
    key: 'VIRAL_QUEUE',
    description: 'Redis Surge-Paced Viral Queue Protection',
    enabledForPlans: 'PRO,ENTERPRISE',
    isEnabled: true,
  },
  {
    id: 'flag-spike-alerts',
    key: 'SPIKE_ALERTS',
    description: 'Real-Time Mobile PWA Push Alerts',
    enabledForPlans: 'PRO,ENTERPRISE',
    isEnabled: true,
  },
  {
    id: 'flag-voice-create',
    key: 'VOICE_CREATE',
    description: 'Voice Funnel Speech-to-Automation',
    enabledForPlans: 'PRO,ENTERPRISE',
    isEnabled: true,
  },
  {
    id: 'flag-follow-gate',
    key: 'FOLLOW_CHECK_GATE',
    description: 'Follow-to-Unlock Quick Reply Gate',
    enabledForPlans: 'PRO,ENTERPRISE',
    isEnabled: true,
  },
];

// Fallback comparison matrix — real data comes from /pricing-promo API
export const DEFAULT_COMPARISON_MATRIX: ComparisonCategory[] = [
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
        free: '∞ Unlimited',
        pro: '∞ Unlimited',
        agency: '∞ Unlimited',
      },
      { name: 'Monthly DM Volume', free: '∞ Unlimited', pro: '∞ Unlimited', agency: '∞ Unlimited' },
      {
        name: 'Keywords Per Campaign',
        free: '∞ Unlimited',
        pro: '∞ Unlimited',
        agency: '∞ Unlimited',
      },
    ],
  },
  {
    category: 'Smart Engines',
    features: [
      { name: 'Smart Reply Desk AI Query Filter', free: true, pro: true, agency: true },
      { name: 'Hinglish & Regional Language Engine', free: true, pro: true, agency: true },
      { name: 'Anti-Spam Copy Variation Rotation', free: true, pro: true, agency: true },
      { name: 'Redis Surge-Paced Viral Queue Protection', free: true, pro: true, agency: true },
      { name: 'Real-Time Mobile PWA Push Alerts', free: true, pro: true, agency: true },
      { name: 'Voice Funnel Speech-to-Automation', free: true, pro: true, agency: true },
      { name: 'Follow-to-Unlock Quick Reply Gate', free: true, pro: true, agency: true },
    ],
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

export const DEFAULT_PRICING_DATA: PricingPromoResponse = {
  plans: DEFAULT_PLANS,
  promo: DEFAULT_PROMO,
  featureFlags: DEFAULT_FEATURE_FLAGS,
  comparisonMatrix: DEFAULT_COMPARISON_MATRIX,
};
