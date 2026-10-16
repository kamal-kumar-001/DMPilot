import { NextResponse } from 'next/server';
import { DEFAULT_PRICING_DATA } from '@/lib/pricing-data';
import { BillingPlan } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dmpilot.org';
  let pricingData = DEFAULT_PRICING_DATA;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${apiUrl}/pricing-promo`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.data?.plans?.length) {
        pricingData = json.data;
      }
    }
  } catch (err) {
    // Graceful fallback to DEFAULT_PRICING_DATA if API is offline or slow
  }

  const formatPrice = (amount: number, cycle: 'monthly' | 'yearly') => {
    if (amount === 0) return 'Free (₹0)';
    return `₹${amount.toLocaleString('en-IN')}/${cycle === 'monthly' ? 'mo' : 'yr'}`;
  };

  const formatLimit = (val: number, label: string) => {
    if (val === -1 || val >= 99999) return `Unlimited ${label}`;
    return `${val.toLocaleString('en-IN')} ${label}`;
  };

  const plansMarkdown = pricingData.plans
    .map((p: BillingPlan) => {
      const isCustom =
        p.key === 'ENTERPRISE' || (p.priceMonthly === 0 && p.priceYearly === 0 && p.key !== 'FREE');
      const pricingLine = isCustom
        ? '**Pricing**: Custom / Contact Sales'
        : `**Pricing**: ${formatPrice(p.priceMonthly, 'monthly')} (Monthly) | ${formatPrice(p.priceYearly, 'yearly')} (Billed Annually)`;

      return `### ${p.name} Plan (${p.key})
- ${pricingLine}
- **Description**: ${p.description || 'Automation suite for creators'}
- **Direct Message Capacity**: ${formatLimit(p.dmLimitMonthly, 'DMs/month')}
- **Active Campaigns**: ${formatLimit(p.campaignLimit, 'Campaigns')}
- **Keyword Triggers**: ${formatLimit(p.keywordLimit, 'Keywords')}
- **Whitelabel**: 100% Clean DMs with ZERO DMPilot branding across all tiers`;
    })
    .join('\n\n');

  const promoSection = pricingData.promo?.enabled
    ? `\n## Active Special Offer\n> ${pricingData.promo.text || 'Special promotional launch discount active!'}\n`
    : '';

  const markdown = `# DMPilot (AutoDM) — Meta-Approved Instagram Business OS

> DMPilot is an autonomous, Meta-certified direct messaging and comment automation platform built for creators, social commerce brands, and agencies. It converts high-volume Instagram engagement (reels, post comments, story replies) into direct buyer conversations, qualified leads, and digital commerce revenue on autopilot.

## Quick Facts
- **Official Website**: https://www.dmpilot.org
- **Developer & Company**: DMPilot (AutoDM)
- **Primary Domain**: Social Commerce, Creator Economy, Instagram DM Automation
- **Meta Certification**: Officially Approved by Meta App Review for Advanced Access (Live Mode)
- **Key Scopes**: \`instagram_business_basic\`, \`instagram_business_manage_messages\`, \`instagram_business_manage_comments\`, \`pages_show_list\`, \`pages_read_engagement\`
- **Compliance**: Meta Platform Terms 3(d)(i), India DPDP Act 2023, 256-bit SSL, AES-256-GCM token encryption
${promoSection}
## Live Pricing & Subscription Tiers (Updated Real-Time)

${plansMarkdown}

## Core Automation Capabilities

1. **Comment-to-DM (\`COMMENT_TO_DM\`)**:
   Automatically monitors reel and post comments 24/7. When a commenter uses a target keyword (e.g., "link", "recipe", "guide", "pricing"), DMPilot instantly delivers a private direct message containing the resource link.

2. **Automated Public Comment Replies (\`COMMENT_REPLY\`)**:
   Posts contextual public comment replies under user comments (e.g., "@username Sent! Check your DMs 🚀") to boost algorithm velocity and confirm delivery.

3. **Keyword Inbox Responder (\`KEYWORD_TO_DM\`)**:
   Instant DM responder that answers direct messages matching campaign keywords 24/7 with zero human intervention.

4. **Follower Gate Protection**:
   Verifies whether a commenter is following the creator's account. Non-followers receive a native Meta Quick Reply prompt ("I am following! 📖") before unlocking links, growing follower counts organically.

5. **Story Reply Automation (\`STORY_REPLY_TO_DM\`)**:
   Automatically engages users when they react or reply to active Instagram Stories.

6. **New Follower Welcome DM (\`WELCOME_DM\`)**:
   Greets new followers automatically in their DMs with onboarding flows and lead magnets.

7. **Hinglish & Multilingual Processing**:
   Engineered for Indian creators and global audiences. Understands Hinglish ("bhai price kya hai"), Tanglish, and 10+ regional Indian languages.

8. **Anti-Spam Copy Rotation & Surge Pacing**:
   Rotates multi-variant message copies every 50 sends and utilizes Redis surge queues to prevent Instagram rate limit blocks.

## Developer & Navigation Links

- **Main Homepage**: https://www.dmpilot.org
- **Pricing & Plans**: https://www.dmpilot.org/pricing
- **Full LLM Manifest**: https://www.dmpilot.org/llms-full.txt
- **About DMPilot**: https://www.dmpilot.org/about
- **Agency & Support Inquiries**: https://www.dmpilot.org/contact
- **Privacy Policy**: https://www.dmpilot.org/privacy
- **Terms of Service**: https://www.dmpilot.org/terms
- **Data Deletion Status**: https://www.dmpilot.org/api/auth/data-deletion
`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
