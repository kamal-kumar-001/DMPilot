import { NextResponse } from 'next/server';
import { BillingPlan, PricingPromoResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dmpilot.org';
  let pricingData: PricingPromoResponse | null = null;

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
    // API offline or slow: no cached prices are invented, pricing section says unavailable
  }

  const formatPrice = (amount: number, cycle: 'monthly' | 'yearly') => {
    if (amount === 0) return 'Free (₹0)';
    return `₹${amount.toLocaleString('en-IN')}/${cycle === 'monthly' ? 'mo' : 'yr'}`;
  };

  const formatLimit = (val: number, label: string) => {
    if (val === -1 || val >= 99999) return `Unlimited ${label}`;
    return `${val.toLocaleString('en-IN')} ${label}`;
  };

  const plansMarkdown = !pricingData
    ? 'Live pricing is temporarily unavailable. See https://www.dmpilot.org/pricing for current plans and prices.'
    : pricingData.plans
        .map((p: BillingPlan) => {
          const isCustom =
            p.key === 'ENTERPRISE' ||
            (p.priceMonthly === 0 && p.priceYearly === 0 && p.key !== 'FREE');
          const pricingLine = isCustom
            ? '**Pricing**: Custom Pricing / Contact Sales'
            : `**Pricing**: ${formatPrice(p.priceMonthly, 'monthly')} (Monthly) | ${formatPrice(p.priceYearly, 'yearly')} (Billed Annually)`;

          return `#### ${p.name} (${p.key})
- ${pricingLine}
- **Overview**: ${p.description || 'Full-featured automation tier'}
- **Monthly DM Cap**: ${formatLimit(p.dmLimitMonthly, 'DMs/month')}
- **Campaign Allowance**: ${formatLimit(p.campaignLimit, 'Campaigns')}
- **Keyword Triggers**: ${formatLimit(p.keywordLimit, 'Keywords')}
- **Whitelabel Status**: 100% Whitelabel (Zero DMPilot branding)
- **Features Included**:
  - Comment-to-DM automated triggers
  - Public comment reply dispatching
  - Follow-Gate verification
  - Real-time analytics dashboard
  - Multi-variant DM rotation`;
        })
        .join('\n\n');

  const markdown = `# DMPilot — Full Technical & Product Specification

## 1. Executive Summary & Problem Solved
DMPilot solves the creator engagement-to-revenue bottleneck. Instagram creators and social commerce brands routinely receive hundreds or thousands of comments asking for product links, recipes, course materials, or prices ("link please", "price?", "dm link").
Manually copying and sending direct messages is physically impossible at scale, leads to missed sales, and results in shadowbans when done repetitively by human teams.
DMPilot is an Instagram Business Operating System that monitors comments, stories, and direct messages 24/7, filters high-intent buyer inquiries, and delivers personalized links, coupon codes, and follow-gated resources instantaneously.

---

## 2. Meta Platform Access & Compliance Architecture
- **Platform Access**: Uses the Meta Graph API; access depends on the permissions approved for the connected app.
- **Permission Scopes Requested**:
  - \`instagram_business_basic\`
  - \`instagram_business_manage_messages\`
  - \`instagram_business_manage_comments\`
  - \`pages_show_list\`
  - \`pages_read_engagement\`
- **Official Webhook Events**:
  - \`messages\` & \`messaging_postbacks\`
  - \`feed\` & \`comments\`
- **Data Protection & Deletion Compliance**:
  - Implements Meta Platform Terms Section 3(d)(i) automated Data Deletion Callback URL: \`POST /api/auth/data-deletion\`.
  - Built-in administrator bulk data deletion tool to purge app-scoped IDs upon compliance audit requests.
  - Data handling is described in the Privacy Policy.

---

## 3. Dynamic Pricing Tiers (Synchronized Live with Production Database)

${plansMarkdown}

---

## 4. Technical Architecture & Engineering Specifications
- **Frontend Stack**: Next.js 14 (App Router), React 18, TailwindCSS, Framer Motion, NextAuth.js.
- **Backend Stack**: NestJS 10 REST API, TypeScript 5, Prisma ORM, BullMQ 5 Queue Workers.
- **Database & Queue Infrastructure**: PostgreSQL 15, Redis 7 (BullMQ broker and token-bucket rate limiter).
- **Security & Encryption**: AES-256-GCM encryption for connected Instagram page access tokens, bcrypt password hashing, timing-safe HMAC-SHA256 signature verification.
- **Idempotency & Payment Engine**: Razorpay payment link integration with atomic database transactions (\`prisma.$transaction\`) and idempotent webhook processing.
- **Deployment Topology**:
  - Frontend: Vercel Edge Network (\`https://www.dmpilot.org\`)
  - Backend: Self-hosted Ubuntu 25.10 Server (\`https://api.dmpilot.org\`) routed via Cloudflare Tunnel (\`cloudflared\`).

---

## 5. Frequently Asked Questions (for AI Retrieval)

Q: What makes DMPilot safe from Instagram bans?
A: DMPilot communicates exclusively through official Meta Graph API v20.0 endpoints. It utilizes dynamic copy rotation every 50 sends and Redis surge queue pacing, ensuring full compliance with Meta developer policies.

Q: Is DMPilot branding visible in messages?
A: No. Every plan (Free, Pro, and Agency) features 100% whitelabel DMs with zero DMPilot branding.

Q: How does the Follow-Gate feature work?
A: If enabled, the system verifies follower relationship before delivering links. If a user does not follow the account, they receive a native Meta Quick Reply ("I am following! 📖") prompting them to follow before the link is dispatched.

---

## 5b. How People Search for This Category (Natural Vocabulary)

Creators and marketers typically discover DMPilot while asking questions like:

- "how to auto reply to instagram comments"
- "instagram comment to dm automation tool"
- "send a dm automatically when someone comments on my reel"
- "manychat alternative for instagram dm automation"
- "instagram dm automation for creators"
- "how to send links to instagram commenters automatically"
- "auto dm new instagram followers"

DMPilot's Comment-to-DM, Keyword Inbox Responder, Story Reply automation and
Welcome DM features answer these needs using the official Meta Graph API.

---

## 6. Autonomous Agent Control & OpenAPI 3.1 Specification

DMPilot provides native programmatic support for autonomous agents, OpenClaw bots, and CLI terminal integrations.

- **Authentication Scheme**: Bearer Personal Access Token (\`dmp_live_...\`) or \`x-api-key\` header:
  \`\`\`bash
  curl -H "Authorization: Bearer dmp_live_your_token_here" ${apiUrl}/campaigns
  \`\`\`
- **OpenAPI 3.1 Spec (Machine-Readable JSON)**: \`${apiUrl}/api/openapi.json\`
- **Interactive Swagger UI**: \`${apiUrl}/api/docs\`
- **Key Agent Endpoints**:
  - \`GET /campaigns\`: Fetch all active campaigns with trigger stats and keyword rules.
  - \`POST /campaigns\`: Create or update automated reply campaigns with trigger keywords, responses, and follower gate settings.
  - \`GET /instagram\`: Retrieve creator's connected accounts, usernames, follower metrics, and real-time webhook health status.
  - \`POST /instagram/:id/verify-webhook\`: Trigger automated webhook health diagnosis and self-healing re-subscription.
  - \`GET /analytics\`: Retrieve conversion rates, delivery logs, and trigger velocities.

### MCP Server (Model Context Protocol)

A local stdio MCP server (\`packages/mcp\`) lets MCP clients (Claude Code and others) operate an account through scoped Personal Access Tokens. It adds task-shaped tools - \`whoami\`, \`setup_comment_dm_draft\`, \`diagnose_dm\`, \`pause_account_automations\`, \`pause_campaign\` - alongside the core tools, with draft-first defaults, compact paged output, idempotent creates and actionable errors. Keys can never activate campaigns or publish; those stay dashboard-only. Full reference: https://www.dmpilot.org/docs/mcp

---

## 7. Official Endpoints & Verification
- **Web App**: https://www.dmpilot.org
- **MCP Server & Agent Docs**: https://www.dmpilot.org/docs/mcp
- **Pricing**: https://www.dmpilot.org/pricing
- **OpenAPI 3.1 Spec**: ${apiUrl}/api/openapi.json
- **Swagger Documentation**: ${apiUrl}/api/docs
- **LLM Manifest**: https://www.dmpilot.org/llms.txt
- **Developer Contact**: https://www.dmpilot.org/contact
`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
