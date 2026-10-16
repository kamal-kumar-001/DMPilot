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
