import type { BillingPlan, ComparisonCategory, FeatureFlag } from '@/types';

// Presentation allowlist, not entitlements. Include only creator-facing features
// with an implemented flow. Never turn arbitrary/admin-only flags into sales claims.
export const CREATOR_COMPARISON_FEATURES = [
  { key: 'NO_BRANDING', label: 'No DMPilot branding in your DMs' },
  { key: 'REPLY_DESK', label: 'Reply Desk for buyer questions' },
  { key: 'FOLLOW_CHECK_GATE', label: 'Follow-to-unlock prompts' },
  { key: 'ANALYTICS_ADVANCED', label: 'Campaign and follower analytics' },
  { key: 'MULTILINGUAL_HINGLISH', label: 'Hinglish keyword matching' },
  { key: 'VOICE_CREATE', label: 'Voice-assisted campaign setup (supported browsers)' },
] as const;

// Extra detail belongs only in the lower matrix, not the compact plan cards.
const AUTOMATION_COMPARISON_FEATURES = [
  { key: 'KEYWORD_TO_DM', label: 'Auto-replies to keywords in incoming DMs' },
  { key: 'WELCOME_DM', label: 'Welcome reply to a first incoming message' },
  { key: 'STORY_REPLY_TO_DM', label: 'Auto-replies to story responses' },
  { key: 'SHARE_TO_DM', label: 'Auto-replies to shared Reels and posts' },
] as const;
const HISTORY_COMPARISON_FEATURES = [
  { key: 'WEBHOOK_LOGS', label: 'Incoming event history for delivery troubleshooting' },
] as const;

export function featureIncluded(flags: FeatureFlag[], key: string, plan: string): boolean {
  // Product invariant: branding is never added, irrespective of a legacy DB flag.
  if (key === 'NO_BRANDING') return true;
  const flag = flags.find((item) => item.key === key);
  if (!flag || !flag.isEnabled) return false;
  const allowed = flag.enabledForPlans.split(',').map((item) => item.trim());
  return allowed.includes(plan) || allowed.includes('ALL');
}

function limit(value: number | undefined, singular: string, plural: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not set';
  if (value === -1) return `Unlimited ${plural}`;
  return `${value.toLocaleString('en-IN')} ${value === 1 ? singular : plural}`;
}

export function buildPricingComparison(plans: BillingPlan[], flags: FeatureFlag[], detailed = true): ComparisonCategory[] {
  const values = (get: (key: string, plan: BillingPlan | undefined) => string | boolean) => ({
    free: get('FREE', plans.find((p) => p.key === 'FREE')),
    pro: get('PRO', plans.find((p) => p.key === 'PRO')),
    agency: get('ENTERPRISE', plans.find((p) => p.key === 'ENTERPRISE')),
  });
  const flagRows = (items: ReadonlyArray<{ key: string; label: string }>) => items
    .filter(({ key }) => key === 'NO_BRANDING' || flags.some((flag) => flag.key === key))
    .map(({ key, label }) => ({ name: label, ...values((plan) => featureIncluded(flags, key, plan)) }));
  return [
    {
      category: 'Usage and accounts',
      features: [
        { name: 'DMs per month', ...values((_, p) => limit(p?.dmLimitMonthly, 'DM', 'DMs')) },
        { name: 'Active campaigns', ...values((_, p) => limit(p?.campaignLimit, 'campaign', 'campaigns')) },
        ...(detailed ? [{ name: 'Keywords per campaign', ...values((_, p) => limit(p?.keywordLimit, 'keyword', 'keywords')) }] : []),
        { name: 'Connected Instagram accounts', ...values((key, p) => {
          if (!p) return 'Not set';
          // MULTI_ACCOUNT gates linking additional accounts; the plan limit still applies.
          const max = featureIncluded(flags, 'MULTI_ACCOUNT', key) ? p.accountLimit : Math.min(p.accountLimit === -1 ? 1 : p.accountLimit, 1);
          return limit(max, 'account', 'accounts');
        }) },
      ],
    },
    ...(detailed && flagRows(AUTOMATION_COMPARISON_FEATURES).length ? [{ category: 'Audience conversations', features: flagRows(AUTOMATION_COMPARISON_FEATURES) }] : []),
    {
      category: 'Tools for creators',
      features: flagRows(CREATOR_COMPARISON_FEATURES),
    },
    ...(detailed && flagRows(HISTORY_COMPARISON_FEATURES).length ? [{ category: 'Delivery visibility', features: flagRows(HISTORY_COMPARISON_FEATURES) }] : []),
  ];
}

export function planHighlights(plan: BillingPlan, flags: FeatureFlag[]): string[] {
  const rows = buildPricingComparison([plan], flags, false);
  const column = plan.key === 'FREE' ? 'free' : plan.key === 'PRO' ? 'pro' : 'agency';
  return rows.flatMap((category) => category.features)
    .filter((feature) => feature.name !== 'No DMPilot branding in your DMs')
    .flatMap((feature) => {
      const value = feature[column];
      if (typeof value === 'boolean') return value ? [feature.name] : [];
      return [feature.name === 'DMs per month' ? `${value} per month` : feature.name === 'Active campaigns' ? value.replace(/campaign(s?)/, 'active campaign$1') : value.replace(/account(s?)/, 'connected Instagram account$1')];
    });
}
