export interface BillingPlan {
  id?: string;
  key: 'FREE' | 'PRO' | 'ENTERPRISE';
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  campaignLimit: number;
  keywordLimit: number;
  dmLimitMonthly: number;
  accountLimit: number;
  highlight?: boolean;
}

export interface PromoSettings {
  text: string;
  enabled: boolean;
  discountPercent: number;
}

export interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabledForPlans: string;
  isEnabled: boolean;
}

export interface ComparisonFeature {
  name: string;
  free: string | boolean;
  pro: string | boolean;
  agency: string | boolean;
}

export interface ComparisonCategory {
  category: string;
  features: ComparisonFeature[];
}

export interface PricingPromoResponse {
  plans: BillingPlan[];
  promo: PromoSettings;
  featureFlags: FeatureFlag[];
  comparisonMatrix: ComparisonCategory[];
}
