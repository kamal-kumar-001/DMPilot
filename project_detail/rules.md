# Development Guidelines & Rules — AutoDM (Instagram Business OS)

This document defines the coding, design, and execution standards for the AutoDM codebase.

---

## 1. Codebase Architecture & Monorepo Boundaries

- **Monorepo Separation**: Do not import NestJS modules inside Next.js packages or vice-versa. Shared contracts must reside in `@autodm/types`.
- **Shared UI Package**: Common design elements (Buttons, Dialogs, Inputs, Labels) must be declared in `@autodm/ui` and referenced across applications.
- **Database Access**: All database queries must use Prisma ORM (`prisma.service.ts`). Raw SQL is permitted only for specialized system checks.

---

## 2. API Design & Controller Standards

- **JSON Envelopes**: Every backend REST controller method must return a standard response object:
  ```json
  {
    "success": true,
    "data": { ... },
    "timestamp": "2026-10-16T10:50:00.000Z"
  }
  ```
- **Guard Protocols**: Protect endpoints using `@UseGuards(JwtAuthGuard)` and role-based guards `@UseGuards(RolesGuard)`.
- **Config Validation**: All environment variables must pass Zod schema validation in `src/config/env.schema.ts` on server startup.
- **Meta Compliance Endpoints**: Never disable signature verification on webhook routes or data deletion callbacks (`/api/auth/data-deletion`).

---

## 3. Frontend & Styling Rules

- **Theme & CSS Variables**:
  - Always use centralized design tokens defined in `packages/ui/src/index.css` and mapped in `packages/ui/src/tailwind.preset.js`:
    - `--bg-app`: `#FAF9F5` (Sejda warm cream canvas)
    - `--bg-surface`: `#FFFFFF` (Crisp pure white surface)
    - `--border-default`: `#E2E8F0`
    - `--text-main`: `#0F172A`, `--text-muted`: `#475569`
  - Do not use hardcoded colors or ad-hoc dark themes.
  - Buttons must use `.btn-gradient` (`from-primary to-accent-cyan text-white shadow-brand`) for primary actions.
  - Cards should use crisp white surfaces (`bg-white border border-slate-200 shadow-sm`) with subtle hover elevation (`hover:shadow-md`).
- **Single Canonical Data Files**: Hardcoded or fallback configurations (such as default pricing tiers, feature flags, plan limits, comparison matrix specifications) must be stored in a single canonical data file (`apps/web/lib/pricing-data.ts` or `landing-data.ts`). Do not duplicate hardcoded values across components. Component state must initialize using this fallback data to guarantee 0ms instant loading before background API sync.
- **API Client Centralization**: Never declare `const API_URL = process.env.NEXT_PUBLIC_API_URL || ...` in individual components. Import `API_BASE_URL`, `apiRequest`, or `fetchWithAuth` from `@/lib/api-client`.
- **Strict Typing & NextAuth**: NextAuth session is extended in `types/next-auth.d.ts` to include `role`, `isVerified`, and `plan`. Do not use `(session?.user as any)?.role` casts.
- **No `console.log` in Production**: Remove all debugging logs before committing. Allow only `console.error` inside catch blocks.
- **Preserved Navigation**: Keep the Follower Analyzer navigation item intact.

---

## 4. Webhook Pipeline & Background Workers

- **Fast Response Time**: Inbound Meta webhooks must acknowledge with HTTP 200 OK in under **200 milliseconds** after verifying HMAC signature and logging to DB.
- **BullMQ Queue Offloading**: Offload all heavy tasks (fetching media posts, executing relationship checks, dispatching DMs) to `send_dm_queue` and `instagram_media_fetch_queue`.
- **Native Instagram Direct Messages**: Direct message buttons **must not open external browser links**. Use native Meta Quick Replies with payload `CONFIRM_FOLLOW_CAMPAIGN_<campaignId>`.
- **Pause Flag Compliance**: Always check `systemSetting` key `webhook_processing_paused` before queueing jobs.

---

## 5. Scaling, High-Concurrency & Payment Engineering Standards

- **Financial & Payment Idempotency**:
  - Every payment webhook handler and checkout confirmation MUST be strictly idempotent.
  - Payment gateway signatures (Razorpay) must always be validated using constant-time buffer comparison (`crypto.timingSafeEqual`) to defeat timing attacks.
  - Never process a plan upgrade or renewal without checking if the invoice/payment record (`paymentId`) was already recorded.
  - Multi-step billing mutations (Subscription update + Invoice creation + Usage reset) MUST execute inside an atomic `prisma.$transaction`.
- **Database Query Hygiene & Anti-N+1 Rules**:
  - **Zero N+1 Queries**: Never execute Prisma database queries inside iterative `.map()` or `.forEach()` loops. Always fetch relational data in batch using eager `include` or `findMany({ where: { id: { in: ids } } })`.
  - **Index Coverage**: Any field used in query filtering (`where`), ordering (`orderBy`), or foreign-key relations MUST be covered by an index or composite index in `prisma/schema.prisma`.
  - **Bounded Queries**: All list queries fetching user data, comments, messages, or audit logs MUST enforce pagination with a strict maximum limit (e.g., `take: Math.min(limit, 100)`).
- **Outbound HTTP Timeouts & Circuit Breakers**:
  - Never execute unbounded or un-timed HTTP requests to external services (Meta Graph API, Razorpay, email providers). Always set explicit timeout configurations (connection: <= 5s, response: <= 10s).
  - Transient network blips or external 5xx responses MUST use exponential backoff with randomized jitter. Unrecoverable errors after 5 attempts must route to the Dead Letter Queue (DLQ).
- **Rate Limiting & Abuse Defense**:
  - Authentication and sensitive endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`) must be guarded by Redis sliding-window rate limiters.
  - Webhooks must be rate-governed with fast cryptographic validation and immediate 200 OK ACK.
- **Thread Safety & Race Conditions**:
  - Shared numerical values (e.g. `UsageRecord.count`, message quotas) must be modified using database atomic increment operations (`increment: 1`) or distributed Redis locks (`Redlock`), never read-then-write in separate statements.
- **LLM Manifest & Discoverability Integrity**:
  - The `/llms.txt` and `/llms-full.txt` endpoints must never hardcode prices, quotas, or plan tiers.
  - They must always fetch current state dynamically from the database (`GET /pricing-promo`) with fallback to canonical defaults.
  - Reputable AI search agents (`GPTBot`, `ClaudeBot`, `PerplexityBot`, etc.) must never be blocked from crawling public marketing, pricing, or LLM manifest routes.
- **Email & SMTP Deliverability Integrity**:
  - Never host raw SMTP or inbound mail servers directly in Docker on general VPS IPs (due to default port 25 blocking and aggressive spam blacklists).
  - Use high-reputation SMTP relay (Resend) with SPF, DKIM, and DMARC aligned on the root/sending domain.
  - Outbound emails MUST set `replyTo: SUPPORT_EMAIL` so user queries route straight to the administrator's personal inbox without requiring local IMAP containers.
  - Senders must always follow the multi-persona domain convention (`no-reply@`, `receipts@`, `notifications@`) based on `MAIL_DOMAIN`.
