# Product Requirements Document (PRD) — AutoDM (Instagram Business OS)

## 1. Product Vision & Executive Summary

AutoDM is India's premier Meta-compliant Instagram DM automation engine and social business operating system. It converts high-volume comment engagement into direct buyer conversations, qualified leads, and digital commerce revenue on autopilot.

---

## 2. Meta App Review Approval & Production Status

AutoDM is **officially approved by Meta** for advanced production access across all core permissions:

- **`instagram_business_basic`**: Read profile metrics, account handle, and media feed.
- **`instagram_business_manage_messages`**: Send and receive automated DMs and interactive Quick Replies for all Instagram users.
- **`instagram_business_manage_comments`**: Read post/reel comments in real time and post automated public comment replies under user comments.
- **`pages_show_list` & `pages_read_engagement`**: Read connected Facebook Pages and manage account channel tokens.

With full Meta review approval, automated DMs and public comment replies are live for all public Instagram accounts worldwide.

---

## 3. Regulatory Compliance & Meta Data Deletion Requirements

In compliance with Meta Platform Terms (Section 3(d)(i)) and India's Digital Personal Data Protection Act (DPDP Act 2023):

1. **Meta Data Deletion Callback URL (`POST /api/auth/data-deletion`)**:
   - Handles de-authorization events when users disconnect the app via Instagram/Facebook.
   - Verifies the HMAC-SHA256 signed request using `META_APP_SECRET`.
   - Purges or anonymizes user data and returns a verifiable `confirmation_code` and public status check URL (`/data-deletion-status?code=...`).
2. **Admin Bulk Data Deletion Tool (`/admin` -> Data Deletion)**:
   - Admin UI allowing administrators to paste batches of Meta app-scoped user IDs or instant game IDs (as provided in Meta privacy compliance emails) and delete all corresponding records from the database in 1 click.

---

## 4. Webhook Audit Logs & Scoping Specs

### Log Table Specifications

The Webhook Audit Logs interface (`/admin` -> Webhooks tab or `<WebhookLogs>`) renders a real-time correlation table:

| Column Header        | Field Source                | Description & Format                                                 |
| -------------------- | --------------------------- | -------------------------------------------------------------------- |
| **Time**             | `WebhookEvent.createdAt`    | Time & date timestamp (`HH:mm:ss YYYY-MM-DD`).                       |
| **Comment ID**       | `WebhookEvent.commentId`    | Native Instagram Comment ID (`1784...`).                             |
| **User**             | `WebhookEvent.username`     | Instagram commenter handle (`@username`).                            |
| **Send Status**      | `WebhookEvent.status`       | Status badge (`PROCESSED`, `FAILED`, `PENDING`, `PAUSED`).           |
| **Error Diagnostic** | `WebhookEvent.errorMessage` | Formatted Meta API error message with error diagnostics.             |
| **fbtrace_id**       | `WebhookEvent.fbtraceId`    | Unique Meta trace ID returned by Graph API for Meta support tickets. |

### Access Scoping & Control Features

- **User-Scoped Creator Access**: Creator users only view webhooks matching their connected Instagram accounts (`userId` scope).
- **Dedicated Admin Audit Tab**: Dedicated "Webhooks Audit" tab in the Admin Panel (`/admin` -> Webhooks tab) for global system inspection.
- **Global Webhook Pause Switch**: Enables 1-click system-wide webhook processing pause/resume.
- **Timeframe Purge Selector**: Allows deleting logs by timeframe (`All Logs`, `Older than 24h`, `Older than 7d`, `Older than 30d`).
- **Failed Jobs Purge & Refresh**: Supports timeframe purging for failed jobs in BullMQ queues and `QueueJob` database records.
- **Section Refresh Buttons**: Header refresh buttons added to Active Automations (`<CampaignsList>`), Analytics (`<StatsGrid>`), Webhooks (`<WebhookLogs>`), and Failed Jobs (`<FailedJobs>`).

---

## 5. Core Automation Campaign Types

| Campaign Type           | Trigger Event                             | Action / Response                              | Use Case                                      |
| ----------------------- | ----------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| **`COMMENT_TO_DM`**     | Public post comment matching keywords     | Sends private DM with digital resource or link | Lead magnets ("Comment 'EBOOK' for guide")    |
| **`KEYWORD_TO_DM`**     | Direct message text matching keywords     | Sends automated direct message reply           | FAQ answering & instant resource delivery     |
| **`WELCOME_DM`**        | New user follows the Instagram account    | Sends automated welcome direct message         | Onboarding new followers & introducing offers |
| **`STORY_REPLY_TO_DM`** | User replies to an active Instagram Story | Sends automated message response flow          | Story flash sales & interactive polls         |
| **`COMMENT_REPLY`**     | Public post comment on Instagram media    | Posts automated public comment reply on post   | Boosting post engagement & algorithm reach    |

---

## 6. Follow Gate Mechanism & Native Instagram Rules

- **Follow Gate Protection**: If enabled on a campaign, the system verifies whether the user is following the Instagram account before delivering campaign materials.
- **Native Quick Reply Constraints**: In compliance with Meta guidelines, direct message buttons **must not open external browser pages**. The system dispatches native Instagram Quick Reply buttons containing payload string `CONFIRM_FOLLOW_CAMPAIGN_<campaignId>`.
- **Confirmation Verification Loop**: When the user taps **"I am following! 📖"**, Meta posts a webhook payload to `/instagram/webhook`. The worker verifies their follow status:
  - **Verified Following**: Delivers the resource link DM.
  - **Not Following**: Prompts them again cleanly inside the direct message thread.
- **Sandbox Verification Mode**: Test accounts ending in odd IDs simulate "Following", while even IDs simulate "Not Following".

---

## 7. Administrative Controls & Portal Capabilities

The system includes an Admin Portal (`/admin`) guarded by `ADMIN` user role privileges:

1. **Creator User Management**: Inspect creators, manage subscription plans (`FREE`, `PRO`, `ENTERPRISE`), suspend/unsuspend accounts, and permanently delete creators with cascading deletion of all campaigns, keywords, connected IG channels, comments, messages, and invoices.
2. **Campaign Supervision**: System-wide campaign status table with pause/archive controls.
3. **Queue Health & Inspector**: Real-time BullMQ job monitoring with raw error stack traces for failed jobs.
4. **Webhook Logging & Controls**: Live Meta webhook event logger. Features a global **Pause Webhook** switch to freeze event ingestion during database maintenance.
5. **Feature Flag Manager**: Dynamic feature flag toggles per subscription plan (`COMMENT_TO_DM`, `WELCOME_DM`, `WEBHOOK_LOGS`).
6. **Promotions Engine**: Configures site-wide marketing banners, promotional discount percentages, and countdown notices.
7. **Support Ticket Resolution**: In-app customer support ticketing module allowing admins to resolve user tickets.
8. **Account Deletion Approval & Bulk ID Purge**: Handles GDPR user account deletion requests and bulk Meta ID deletion.

---

## 8. Pricing Matrix & Feature Flags

| Plan Tier    | Price (Monthly / Yearly)   | Campaign Limit | Keyword Limit | DM Limit (Monthly) | Enabled Capabilities                              |
| ------------ | -------------------------- | -------------- | ------------- | ------------------ | ------------------------------------------------- |
| **`FREE`**   | ₹0 / ₹0                    | 1 Campaign     | 3 Keywords    | 100 DMs            | Standard Comment-to-DM                            |
| **`PRO`**    | ₹999 / ₹832/mo (₹9,990/yr) | 10 Campaigns   | 25 Keywords   | 5,000 DMs          | All Campaign Types + Follow Gate + Analytics      |
| **`AGENCY`** | Contact Us                 | Custom         | Custom        | Custom             | Priority Queue + Webhook Logs + Dedicated Support |

---

## 9. AI Automation & Intelligence Roadmap (Claude / Anthropic Integration)

AutoDM is expanding its intelligence layer via Claude API integration:

1. **AI Comment Analysis & Sentiment Reporting**: Real-time evaluation of comment sentiment, intent classification (high-intent buyer, support request, general engagement, spam), and aggregated creator executive reports.
2. **Context-Aware Auto-Replies**: Dynamic, human-like comment replies and DM responses in Hinglish and regional languages, adapting tone to match creator voice.
3. **Smart Lead Scoring**: Automatically tagging and scoring commenter buyer intent before routing high-value prospects into CRM pipelines.

---

## 10. High-Scale Production SLAs & Payment Reliability (Non-Functional Requirements)

To support massive creator scaling and enterprise-grade payment integration without operational friction:

1. **Payment Reliability SLA**:
   - **Zero Duplicate Billing**: 100% idempotent webhook handling (`payment_link.paid`) with duplicate rejection.
   - **Fast Webhook ACK**: Webhooks acknowledge receipt in `< 150ms` before background jobs trigger.
   - **Financial Audit Consistency**: Invoices and subscriptions guaranteed atomic consistency via database transactions.
2. **Scale & Throughput Targets**:
   - **Daily Volume**: Designed to process 100,000+ automated DMs and comments daily with BullMQ queue worker concurrency.
   - **Viral Reel Surge Absorption**: Redis token-bucket pacing prevents Meta API rate limits (HTTP 429) during viral engagement spikes.
3. **Latency Benchmarks**:
   - **API Response Time**: P95 < 150ms, P99 < 300ms across all authenticated creator dashboard endpoints.
   - **Inbound Webhook ACK**: P99 < 180ms to remain comfortably within Meta's 5-second webhook timeout window.
4. **Availability & Fault Tolerance**:
   - **System Uptime**: 99.9% target availability.
   - **Graceful Degradation**: If Meta API experiences outages, jobs queue in Redis with exponential backoff and jitter without dropping user requests.
   - **Dead Letter Queue (DLQ)**: Zero silent message failures; unrecoverable events route to DLQ with diagnostic error traces.

---

## 11. LLM & AI Agent Discoverability Requirements

To ensure that large language models (such as ChatGPT, Claude, Perplexity, Gemini, Cursor) accurately represent DMPilot's capabilities and live pricing when searched by users:

1. **Standard `/llms.txt` & `/llms-full.txt` Interface**:
   - Provide clean, markdown-formatted summaries at `/llms.txt` and `/llms-full.txt` matching the llmstxt.org specification.
2. **Zero Hardcoding Guarantee**:
   - Pricing, plan names, DM limits, and launch promotions must be generated dynamically from the production database via `/pricing-promo`.
   - Never hardcode numbers or feature tiers in static markdown files exposed to LLMs.
3. **AI Crawler Ingestion Support**:
   - Explicitly permit reputable AI agents (`GPTBot`, `ClaudeBot`, `PerplexityBot`, etc.) in `robots.ts`.
4. **Structured JSON-LD Metadata**:
   - Public pages must render Schema.org `SoftwareApplication` microdata with dynamic price ranges and customer satisfaction ratings.

---

## 12. Transactional Email & Support Communication Requirements

1. **Lightweight, Zero-Cost Outbound SMTP**:
   - Transactional emails must be dispatched via Resend SMTP using existing Nodemailer stack (up to 3,000 monthly emails free, zero forced footer branding).
2. **Multi-Persona Sender Architecture**:
   - Automated emails must be sent from persona-specific sender aliases under `MAIL_DOMAIN` (`no-reply@domain.com`, `receipts@domain.com`, `notifications@domain.com`).
3. **High-Priority Lifecycle & Quota Alerts**:
   - System must alert creators on critical lifecycle milestones:
     - **Plan Expiration Alert**: Pre-expiration warning (e.g. 3 days before cutoff) with paused automation impact notices.
     - **DM Quota Alerts**: Early warning at 90% and critical alert at 100% capacity to prevent customer engagement drops during viral campaigns.
     - **Payment Invoices / Receipts**: Immediate receipt confirmation upon subscription renewal.
4. **Zero-Overhead Inbound Query Routing**:
   - Support queries must route via Cloudflare Email Routing directly to the admin's personal email inbox (`SUPPORT_EMAIL`).
   - All outbound transactional emails must set `replyTo: SUPPORT_EMAIL` so user replies land in the admin's personal inbox without running heavy Docker mail servers.

---

## 13. Private "Share to DM" (Reel & Post) Product Requirements

1. **Frictionless Follower Engagement**:
   - Followers who do not want to leave public comments must be able to share a Reel or Post directly into the creator's DMs and receive the resource link automatically.
2. **Flexible Triggering Rules**:
   - Creators can tie automation to a specific Reel/Post or set up a universal responder for any shared content.
   - Keywords are strictly optional on shared media, allowing 1-tap instant link dispatch.
3. **Cross-Compatibility**:
   - Existing `COMMENT_TO_DM` campaigns must also respond automatically if their specific Reel/Post is sent in DMs.

---

## 14. Progressive Web App (PWA) & Mobile-First Requirements

1. **Native App-Like Experience (PWA)**:
   - Full W3C manifest specification supporting standalone display, orientation locking, splash background (`#090D16`), and theme color (`#00BB88`).
   - Service Worker precaching app shell with stale-while-revalidate for static assets, network-first navigation, and real-time bypass for API/auth routes.
   - 100% installable on Android, Chrome, Edge, and iOS.
2. **Prominent Multi-Surface Install CTAs**:
   - Desktop and Mobile landing page navbars must offer visible "Install App" triggers.
   - Creator dashboard must offer install buttons in both sidebar and top header controls.
   - Uninstalled mobile visitors must receive a sleek non-intrusive bottom banner prompt.
3. **Cross-Platform Compatibility**:
   - Android & Chromium browsers: Trigger native `beforeinstallprompt`.
   - iOS Safari: Provide step-by-step visual guidance ("Share" ➔ "Add to Home Screen").
4. **Mobile Usability & Touch Performance**:
   - Safe-area support for notched displays (`safe-top`, `safe-bottom`).
   - `touch-action: manipulation` eliminating 300ms mobile tap latency.
   - Smooth `-webkit-overflow-scrolling: touch` across all tables, modal forms, and log viewports.
