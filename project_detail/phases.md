# Phased Roadmap Document — Transition to Instagram Business OS

AutoDM's foundation establishes a robust automated messaging and comment engine. The roadmap details the steps to transition the platform into a comprehensive **Instagram Business OS** for social commerce, lead nurturing, and creators.

---

## Phase 1: Automation Core, Webhook Engine & Meta App Review (Completed)

- Multi-campaign automation engine (`COMMENT_TO_DM`, `KEYWORD_TO_DM`, `WELCOME_DM`, `STORY_REPLY_TO_DM`, `COMMENT_REPLY`).
- Direct Message queues powered by BullMQ 5 and Redis 7.
- Webhook ingestion with Pause and Purge controls.
- Live follower verification check with Quick Reply confirm prompts.
- Database-synced feature locks and `/pricing` comparison page.
- **Meta App Review Approval**: Officially approved by Meta for `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`, `pages_show_list`, and `pages_read_engagement`.
- **Meta Privacy Compliance**: Automated Data Deletion Callback URL (`/api/auth/data-deletion`) and Admin Bulk Data Deletion tools.
- **Design System Overhaul**: Clean Sejda-inspired light theme (`#FAF9F5` canvas, crisp `#FFFFFF` cards, emerald-cyan brand gradient) with centralized CSS variables in `packages/ui/src/index.css`.
- Production hosting topology: Ubuntu 25.10 Lab PC backend + Cloudflare Tunnel (`api.dmpilot.org`) + Vercel frontend (`www.dmpilot.org`).

---

## Phase 2: CRM Lead Pipelines & Creator Pipelines (Target: Q3 2026)

- **Lead Board (Kanban style)**: Automatically create a CRM contact when a user triggers a DM. Categorize them: "New Lead", "Interested", "Responded", "Converted".
- **Interaction History**: Detailed profile dashboards showing user comments, direct message threads, and clicked resource links.
- **Auto-Tagging**: Assign tags to commenters dynamically based on which campaign triggered their interaction (e.g. `ebook-downloader`, `vip-promo`).

---

## Phase 3: Conversational AI & Claude Intelligence (Target: Q4 2026)

- **Claude API Integration (Anthropic Startup Program)**:
  - **Comment Sentiment & Intent Analysis**: Categorize inbound comments in real time (high-intent buyer, customer service, positive review, spam/troll).
  - **Executive Comment Reports**: Automated daily/weekly summaries for creators highlighting trending topics, top buyer queries, and viral engagement drivers.
  - **Context-Aware Auto-Replies**: Human-like public comment responses and DM conversational replies in Hinglish and 10+ regional Indian languages.
- **Smart FAQ Autopilot**: Crawl landing pages and knowledge bases to auto-answer creator customer queries regarding pricing, availability, and support in-chat.

---

## Phase 4: Social Commerce & Razorpay Checkout Integration (Target: Q1 2027)

- **Product Catalogs inside DMs**: Let creators import Shopify or custom catalogs and show cards/links natively in Instagram chats.
- **In-Chat Checkout**: Send direct Razorpay payment buttons. Once paid, webhook events automatically trigger digital delivery (links, files) inside DMs.
- **Discount Banner Synchronization**: Run automated promotional sales that update landing headers, pricing calculators, and DM discount codes in sync.

---

## Phase 5: Multi-Channel Expansion (Target: Q2 2027)

- Support for Facebook Messenger, WhatsApp Business, and direct SMS automations under a unified creator inbox dashboard.
