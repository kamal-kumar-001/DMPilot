# Context Memory & System Constraints — AutoDM (Instagram Business OS)

## 1. Environment & Infrastructure Topology

- **Production API Base URL**: `https://api.dmpilot.org`
  - Hosted on a physical Ubuntu 25.10 Lab PC listening on port `4000`.
  - Publicly exposed via Cloudflare Tunnel (`cloudflared`) forwarding traffic directly to `localhost:4000`.
  - PostgreSQL (Database) and Redis 7 (Queue broker) run locally on the Ubuntu host.
- **Production Frontend URL**: `https://www.dmpilot.org` (and `https://dmpilot.org`)
  - Deployed on Vercel Edge Cloud.
- **Development Workstation**: macOS workstation used for active code editing, testing, and git pushes.
- **Local Fallback Base URL**: `http://localhost:4000` (API) & `http://localhost:3000` (Web).

---

## 2. Critical Meta API & Button Interaction Rules

- **No External Links inside Instagram Direct Messages**: Direct message buttons **must not open external websites or browser webviews**.
- **Native Quick Replies**: All interactive confirmations use native Meta Direct Message **Quick Reply** buttons with custom payload routing:
  ```json
  {
    "recipient": { "id": "<recipient_id>" },
    "message": {
      "text": "Hey! Tap below once you are following to unlock your download link:",
      "quick_replies": [
        {
          "content_type": "text",
          "title": "I am following! 📖",
          "payload": "CONFIRM_FOLLOW_CAMPAIGN_<campaignId>"
        }
      ]
    }
  }
  ```
- **Sandbox Odd/Even ID Fallback**: To facilitate testing without live Graph API tokens:
  - Recipient ID ending in an **odd number** (e.g. `...12345`) = Simulated as "Following" (prompt bypassed).
  - Recipient ID ending in an **even number** (e.g. `...12342`) = Simulated as "Not Following" (Follow Prompt sent).
- **Meta App Review Approved**: The application is officially approved by Meta for advanced production access (`instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`, `pages_show_list`, `pages_read_engagement`).

---

## 3. Account Linking & OAuth Handshake Steps

1. User logs in to Facebook via NextAuth / OAuth dialog (`/instagram/connect`).
2. Requests approved Meta permission scopes:
   - `instagram_business_basic`: Access account profile & media.
   - `instagram_business_manage_messages`: Send and receive direct messages.
   - `instagram_business_manage_comments`: Read comments and post public replies.
   - `pages_show_list` & `pages_read_engagement`: Access linked Facebook Pages.
3. System exchanges short-lived user token for a 60-day long-lived access token.
4. Auto-subscribes the connected Facebook Page to application webhooks (`POST /v20.0/{page_id}/subscribed_apps`).
5. Stores page access token transparently encrypted with AES-256-GCM in PostgreSQL.

---

## 4. Context Memory Document — AutoDM (Instagram Business OS)

## Session Updates (August 2026)

### 1. Landing Page Glassmorphic Styling & Tab Padding Alignment (`Features.tsx`)

- **PWA Mobile Device Frame Background**:
  - Removed harsh pitch-black background (`bg-black`).
  - Upgraded to a sleek dark glassmorphic gradient:
    `bg-gradient-to-b from-[#0e1726] via-[#090d16] to-[#04070d] border-2 border-primary/30 shadow-[0_0_50px_rgba(0,187,136,0.2)]`.
  - Perfectly matches the overall site design system.
- **Six Innovations Preview Card Backgrounds**:
  - Removed internal black boxes (`bg-black/60` & `bg-black/40`).
  - Upgraded to dark glassmorphic containers:
    `bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl border border-white/10 shadow-glass`.
- **Smart Auto-Reply Tab Padding Fix**:
  - Added generous container left padding (`px-4 sm:px-8` on outer wrapper, `px-4 sm:px-6` on flex container).
  - Ensured the first tab ("Smart Auto-Reply") has clean left margin/padding so it is **never clipped or cut off** on mobile or desktop viewports.

### 2. GitHub Push & Production Server Sync

- All commits pushed to GitHub `origin/main` (`bc745b0`). Running `git pull origin main` on the production server will fetch all latest fixes automatically!

### 3. Complete Dynamic Pricing & Plan Settings Synchronization

- **Database & Admin Control (`apps/api`)**:
  - `GET /pricing-promo` and `GET /billing/plans` fetch plan data directly from the `BillingPlan` database table.
  - When the Admin updates plan details (`PATCH /admin/plans/:key`), prices, limits, or names via Admin Panel, the database updates in real time and automatically reflects across all frontend pages.
- **Pricing Page Sync (`apps/web/app/pricing/page.tsx`)**:
  - Displays dynamic plan details from `GET /pricing-promo`.
  - Monthly vs Annual toggle renders the monthly discounted price for Pro (`₹832/mo billed annually ₹9,990/yr`).
  - Agency plan renders **"Contact Us"** with direct CTA to `/contact?subject=Agency`.
- **Settings & Upgrade Plan Tab Sync (`apps/web/app/settings/page.tsx`)**:
  - Fetches `/billing/plans` dynamically from database.
  - Updated card rendering in `/settings` to match `/pricing` layout:
    - Agency plan renders **"Contact Us"** and **"Contact Agency Sales"** CTA routing to `/contact?subject=Agency`.
    - Pro plan renders monthly rate (`₹999/mo`) or annual rate (`₹832/mo billed annually ₹9,990/yr`).
    - Added `✨ No AutoDM Branding (Whitelabel DMs)` feature badge to all plan cards in Settings.

### 2. Delivered DM Counting Rule (`subscription.service.ts`)

- **Strict Delivered DM Counting**:
  - `SubscriptionService.checkLimit('max_dms_per_month')` counts ONLY messages with status `DELIVERED` or `SENT` in the current month billing period (`instagramAccount: { userId }`).
  - Failed, pending, or skipped messages never consume the user's monthly DM quota.

### 3. Upfront UX Plan Gating & Upgrade Modal (`apps/web`)

- **Upfront Gating Check**:
  - On the Automations page (`apps/web/app/automations/page.tsx`), clicking "+ Create Campaign" checks the user's plan limit upfront.
  - If the campaign limit is reached, it prevents opening the multi-step creation wizard and pops open `<UpgradeModal />` immediately:
    _"Campaign Limit Reached (X / Y Active Campaigns). Upgrade to Pro for unlimited campaigns!"_ with a direct CTA to `/pricing`.
  - Users are never allowed to spend time filling out a multi-step form only to be rejected at the final submit step.

### 4. 1-Click "Enable App Review Mode" in Admin Panel (`apps/api` & `apps/web`)

- Added backend endpoint `POST /admin/enable-app-review-mode` and 1-click button in the Admin Panel header (`apps/web/app/admin/page.tsx`):
  `🚀 Enable App Review Mode (Unlock All Plans & Flags)`
- With 1 click, the admin can ensure all plan limits are set to 999,999 and all feature flags are enabled across all plans for Meta App Review.

### 5. Pricing Plan Selection & Callback Checkout Flow (`pricing/page.tsx`, `login/page.tsx`, `register/page.tsx`, `checkout/page.tsx`)

- **Logged-In Users**:
  - Clicking "Get Started Pro" (or any plan CTA on `/pricing`) detects `session.user` and navigates directly to `/checkout?plan=PRO&cycle=YEARLY` (or `MONTHLY`).
  - On `/checkout`, name and email are automatically pre-filled from `session.user`.
- **Non-Logged-In Users**:
  - Clicking a plan CTA redirects to `/login?callbackUrl=%2Fcheckout%3Fplan%3DPRO%26cycle%3DYEARLY`.
  - Logging in or completing registration seamlessly forwards the user to `/checkout?plan=PRO&cycle=YEARLY` with their details auto-filled.
  - Switches between Login and Register preserve the `callbackUrl`.

### 6. Single-Click Logout Bug Resolution (`auth-helpers.ts` & `login/page.tsx`)

- **Root Cause Identified**:
  When users clicked "Log Out", `signOut({ callbackUrl: '/login' })` immediately triggered a page navigation to `/login`. On initial mount of `LoginPage`, NextAuth's client React context (`useSession()`) held in-memory session data for a brief moment before the HTTP request to `/api/auth/session` returned null. `LoginPage`'s `useEffect` saw `status === 'authenticated'` during that race window and executed `router.push('/dashboard')`, bouncing the user back to the dashboard and requiring a second click to log out!
- **Fix Implemented**:
  1. Created `handleLogout` helper in `apps/web/lib/auth-helpers.ts`:
     - Clears client session/storage caches (`sessionStorage.clear()`, `localStorage.removeItem('nextauth.message')`).
     - Executes `signOut({ redirect: true, callbackUrl: '/login?logged_out=1' })`.
  2. Updated `LoginPage` (`apps/web/app/login/page.tsx`):
     - Detects `searchParams.get('logged_out') === '1'`.
     - Explicitly suppresses any `authenticated` auto-redirect to `/dashboard` when `logged_out=1` is present.
     - Displays a clean green success toast (`"Logged out successfully"`).
  3. Updated all Logout buttons across `sidebar.tsx`, `layout.tsx`, `admin-layout.tsx`, and `providers.tsx` to use `handleLogout()`.
  4. Now logging out works in **one single click**, with zero double-redirects or bounce-back!

### 3. Pricing Page Logic Restoration & Contact Us Agency Card (`apps/web/app/pricing/page.tsx` & `pricing-data.ts`)

- **Pro Plan Pricing Logic**:
  - Monthly mode: `₹999 / mo`
  - Yearly mode: Displays the **monthly discounted rate as the primary hero price** (`₹832 / mo`) with subtext `billed annually (₹9,990/year • Save 17%)`.
- **Agency Plan Card**:
  - Removed all numerical prices and seat sliders.
  - Price label: **"Contact Us"**
  - Subtext: _"Tailored for agencies, talent rosters & big creator networks"_
  - CTA Button: **"Contact Us"** linking directly to `/contact?subject=Agency`.
- **100% OFF Progress Bar Banner**: Preserved intact below the header title/subtitle.
- **Feature Comparison Matrix**: Restored clean, high-contrast feature specs matrix comparing Free, Pro, and Agency plans.

### 2. Six Innovations Section Layout & Scrollbar Fix (`Features.tsx`)

- **Slideable Tab Bar**: Made the 6 option tabs smoothly slideable/scrollable across desktop and mobile.
- **Cutting-Off Fix**: Applied `px-4 sm:px-6 max-w-7xl mx-auto px-2` container alignment so the first option is never cut off at the left border.
- **Hidden Scrollbar**: Applied `scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden` to hide raw scrollbars.

### 3. 3D Scroll Perspective Animations & Modern Motion (`Framer Motion`)

- Added Framer Motion `useScroll`, `useTransform`, and 3D perspective transformations (`perspective: 1000`, `rotateX`, `scale`, `y`, `opacity`) across:
  - **`Hero.tsx`**: 3D tilted dashboard mockup preview card that responds as the user scrolls.
  - **`Features.tsx`**: 3D perspective interactive feature card that rotates into view.
  - **`SetupGuide.tsx`**: 3D perspective step cards with hover lift & glowing border effects.
  - **`Personas` & `Mobile PWA`**: Smooth 3D entrance and floating phone preview.

### 4. Regulatory Context & Legal Compliance Audit (India DPDP Act 2023 & Meta Developer Policy)

- **India Digital Personal Data Protection Act (DPDP Act 2023)**:
  - Fines up to **₹250 Crore (~$30M USD)** per incident for non-compliance, un-consented personal data processing, or unencrypted data leaks.
  - Requires **explicit**, **unambiguous**, and **un-checked-by-default** consent checkboxes for processing user personal data.
- **Meta Platform Terms & Graph API Policy**:
  - Requires explicit consent for processing Instagram user messages and comments.
  - Requires public Terms of Service, Privacy Policy, and Data Deletion Callback endpoint (`/api/auth/data-deletion`).

### 2. Mandatory Consent Checkboxes & Auth Form Hardening (`RegisterPage` & `LoginPage`)

- **Registration Form (`apps/web/app/register/page.tsx`)**:
  - Added mandatory consent checkbox validated via Zod schema (`acceptTerms: z.boolean().refine((val) => val === true)`).
  - Form submit button remains disabled until the user explicitly checks:
    `[x] I agree to the Terms of Service and Privacy Policy, and consent to processing my account data in compliance with India DPDP Act 2023 & Meta Developer Policy.`
  - Added 256-bit SSL & DPDP Act compliance trust badge.
- **Login Form (`apps/web/app/login/page.tsx`)**:
  - Added compliance footer notice with direct links to `/terms` and `/privacy`.

### 3. Data Leak Hardening & Sensitive Log Sanitization (`apps/api`)

- **NestJS Logger Sanitization (`apps/api/src/common/logger/logger.service.ts`)**:
  - Implemented regex pattern masking (`"password"`, `access_token`, `Bearer tokens`) across all `log()`, `warn()`, `error()`, and `debug()` channels to ensure credentials are never leaked to logs or stdout.
- **Data Deletion Callback (`auth.controller.ts`)**:
  - Endpoint `@Post('data-deletion')` handles Meta Graph API data deletion requests, returning a valid `confirmation_code` and privacy redirect URL.
- **Database Parameterization & Encryption**:
  - All database queries run through Prisma ORM parameterized SQL statements preventing SQL injection.
  - OAuth tokens are encrypted at rest with AES-256-GCM.

### 4. Landing Page Navbar Clean-Up (`Navbar.tsx` & `landing-data.ts`)

- Updated `LANDING_NAV.links` to strictly include 4 items:
  1. **Features**: `#features`
  2. **Pricing**: `/pricing`
  3. **About**: `/about`
  4. **Contact**: `/contact`
- Cleaned up duplicate link renders in `Navbar.tsx`.

### 5. Hero Section & "How It Works" Button (`Hero.tsx` & `SetupGuide.tsx`)

- Changed Hero secondary button text to **"How It Works"** with `Play` icon accent.
- Configured smooth scrolling targeting `id="how-it-works"` on the Setup Guide section.
- Replaced unsubstantiated `#1` claim badge with authentic messaging: `⚡ Autonomous Meta-Certified Instagram Growth Engine for Indian Creators`.

### 3. Six Innovations De-clutter & Interactive Showcase (`Features.tsx`)

- Transformed 6 heavy grid cards into a **sleek, interactive tabbed showcase** powered by Framer Motion (`AnimatePresence`, `motion.div`, smooth tab transitions).
- Reduces page vertical scroll clutter by 70% while adding interactive visual previews for Smart Reply Desk, Hinglish Engine, Anti-Spam Copy Rotation, Surge Pacing, Mobile Alerts, and Voice Funnel.

### 4. Pricing Page Overhaul & 100% OFF Progress Bar (`apps/web/app/pricing/page.tsx` & `pricing-data.ts`)

- **Top Banner**: Removed top ticker banner from `/pricing`.
- **Pro Plan Pricing**: Updated Pro plan pricing to **₹999 / month** and **₹9,990 / year** (Save ~17%).
- **100% OFF Launch Offer Progress Banner**: Created progress bar banner below pricing title/subtitle, above Monthly/Yearly toggle switch:
  - Title: `⚡ Special Launch Offer: 100% OFF for First 100 Users!`
  - Subtitle: `Get 100% free access to all core automation features.`
  - Progress bar: `84 / 100 Spots Claimed (16 Remaining)`.
- **Highlight Feature in All Plans**: Added **"✨ No AutoDM Branding (Clean Whitelabel DMs)"** to Free, Pro, and Agency plan feature lists and comparison matrix.

### 5. Delivery Log Overhaul (`GET /monitoring/delivery-logs`)

- **Root Cause Discovered**: Previous webhook query filtered `WebhookEvent.username` matching creator's account handle (`a.username`), causing every feed row to label as `@creator_username got the DM`. Additionally, `RECEIVED` detail displayed outgoing DM text instead of the commenter's actual comment.
- **Architecture Fix Implemented**:
  1. Created `GET /monitoring/delivery-logs` endpoint joining `Comment`, `Message`, `Campaign`, and `InstagramAccount` models.
  2. `commenterUsername` dynamically resolves to **Commenter's Instagram handle** (`Comment.username`, e.g., `@smeet_kevadiya`, `@cosmosbyrudra`).
  3. `commentText` displays the **actual comment typed by commenter** (e.g. `"bhai price kya hai"`, `"DHAN"`).
  4. Redesigned `<CreatorDeliveryLog />` component to match AutoDM's dark glassmorphism theme (`#09090b` dark cards, pink/rose gradient accents, high contrast typography).
  5. Accordion details reveal:
     - **COMMENT RECEIVED**: Commenter's actual comment
     - **MATCHED CAMPAIGN**: Campaign name & matched keyword
     - **DM DELIVERED**: Exact DM text delivered to commenter
     - **Delivery Trace**: Comment ID & Meta `fbtrace_id`

### 6. Live Inbox Auto-Scroll Lock Fix (`app/inbox/page.tsx`)

- **Root Cause Identified**: `useEffect` listening on `[messages]` state executed `messagesEndRef.current?.scrollIntoView()` unconditionally every 4 seconds during polling, pulling the scrollbar down automatically while the creator was trying to scroll up and read past messages.
- **Fix Implemented**: Added `onScroll` handler on `chatContainerRef` tracking `isUserScrolledUp`. Auto-scrolling pauses when creator scrolls up, and a floating `"↓ Scroll to Latest Messages"` pill button appears to jump to the bottom on demand.

### 3. Instagram Native App Reply Thread Grouping Fix (`message-automation.service.ts` & `instagram.service.ts`)

- **Root Cause Identified**: When a creator replied to a commenter from their native Instagram mobile app, incoming webhook had `fromId = creatorId` and `recipientId = customerId`. `message-automation.service.ts` previously saved `recipientId = fromId`, grouping replies into a separate thread for the creator themselves (`my named chat`).
- **Fix Implemented**:
  1. `message-automation.service.ts` detects native app creator replies (`fromId === account.instagramId`), setting `direction = MessageDirection.OUTGOING` and `recipientId = event.recipientId` (the customer).
  2. `instagram.service.ts` groups conversations by `partnerId = (msg.senderId === accountIgId) ? msg.recipientId : msg.senderId`.
  3. `getMessages` queries `where: { instagramAccountId: { in: accountIds }, OR: [{ recipientId }, { senderId: recipientId }] }`, unifying all messages under the customer's chat thread.

### 4. Section Refresh Controls (`RefreshCw` Icon & Active Spin)

- Updated section headers across `<WebhookLogs>`, `<FailedJobs>`, `<CampaignsList>`, `<StatsGrid>`, and Admin Monitoring to use `RefreshCw` with active `animate-spin` loading feedback.
- Creators and Admins can refresh data in any section independently without reloading full pages.

### 3. Failed Jobs Sync & Timeframe Delete Functionality

- Enhanced `MonitoringService.getFailedJobs` to aggregate failed jobs from both BullMQ queues (`send_dm`, `instagram_media_fetch`) and `QueueJob` database records where `status = 'FAILED'`.
- Implemented `DELETE /monitoring/failed-jobs` supporting timeframe purging (`All Failed`, `Older than 24h`, `Older than 7d`, `Older than 30d`) with UI controls in `<FailedJobs>`.
- **SEO & Google Search Console Verification**: Configured `verification: { google: 'HFp8bpyG41psm7hb5aYEgShOZ50wfwEnVCsbBKZEfp8' }` in `apps/web/app/layout.tsx` metadata. Renders `<meta name="google-site-verification" content="HFp8bpyG41psm7hb5aYEgShOZ50wfwEnVCsbBKZEfp8" />` across all pages.
- **Pricing Data Centralization & Instant Loading**: Created `apps/web/lib/pricing-data.ts` as the single canonical file containing fallback pricing plans (`DEFAULT_PLANS`), launch promotions (`DEFAULT_PROMO`), plan feature flags (`DEFAULT_FEATURE_FLAGS`), and comparison matrix specifications (`COMPARISON_SPECIFICATIONS`). Pricing page (`/pricing`) initializes state immediately with this data, eliminating full-screen loading spinners and guaranteeing **0ms instant rendering** even if backend APIs are offline or unreachable.
- **API Client Centralization**: Converted all raw `fetch` calls across 18 components to use `@/lib/api-client` utilities (`apiRequest` & `fetchWithAuth`).
- **Session Type Augmentation**: Extended `next-auth` module definitions (`types/next-auth.d.ts`) to natively include `role`, `isVerified`, and `plan` on `session.user`. Replaced 14 unsafe `(session?.user as any)?.role` casts with standard typed access.
- **Dead Code Cleanup**: Removed unused `lib/env.ts` utility.
- **TypeScript & Linter Enforcement**: 0 TypeScript compilation errors, 0 `console.log` statements, 0 `as any` casts.

---

## Session Updates (October 2026)

### 1. Meta App Review Official Approval

- **Approved Permissions**:
  - `instagram_business_basic`
  - `instagram_business_manage_messages`
  - `instagram_business_manage_comments`
  - `pages_show_list` & `pages_read_engagement`
- **Live Mode Transition**: Advanced production access granted. Automated DMs and comment replies are now active for all public accounts without requiring Meta tester registration.

### 2. Meta Compliance & Data Deletion

- **Data Deletion Callback (`POST /api/auth/data-deletion`)**:
  - Implemented HMAC-SHA256 signature verification using `META_APP_SECRET`.
  - Responds with unique `confirmation_code` and public status check URL (`/data-deletion-status?code=...`) per Meta Platform Terms Section 3(d)(i).
- **Admin Bulk Data Deletion Panel (`/admin`)**:
  - Allows pasting lists of Meta app-scoped user IDs or instant game IDs from compliance emails to purge matching records from database in 1 click.

### 3. Sejda-Inspired Clean Light Theme Redesign & Centralized Tokens

- **Unified CSS Variables (`packages/ui/src/index.css` & `tailwind.preset.js`)**:
  - Single point of control for the entire design system:
    - `--bg-app`: `#FAF9F5` (Sejda warm cream canvas)
    - `--bg-surface`: `#FFFFFF` (Crisp pure white cards)
    - `--border-default`: `#E2E8F0`
    - `--text-main`: `#0F172A`, `--text-muted`: `#475569`, `--text-subtle`: `#94A3B8`
    - `--primary-gradient`: Mint Emerald (`#00BB88`) to Cyan (`#06B6D4`)
    - Elevation shadows: `--shadow-card` and `--shadow-card-hover`
- **UI Component Primitives Updated**:
  - `<Button>`: Features signature `.btn-gradient` (`from-primary to-accent-cyan text-white shadow-brand`) with clean hover lift.
  - `<Input>`: Crisp white surface, slate border, dark text.
  - `<Dialog>`: White modal container with soft backdrop blur.
- **Component & Route Cleanup**:
  - Removed dark gaming noise overlay and `.dark` defaults in root `layout.tsx`.
  - Deleted `apps/web/app/dashboard/delivery-logs` (redundant route).
  - Deleted `apps/web/app/monitoring/page.tsx` (empty redirect route).
  - Removed `SurgeAlertBanner` from dashboard (`apps/web/components/dashboard/surge-alert-banner.tsx` deleted).
  - **Preserved Follower Analyzer navigation link** as explicitly requested.
- **Public Pages Redesigned**:
  - Fully redesigned Landing page (Navbar, Hero with 3D simulation card, TrustedBy, Features, DashboardMockup, Testimonials, SetupGuide, FAQ, Footer).
  - Pricing, About, Contact, Terms, and Privacy pages refreshed with crisp white cards and soft shadows.
  - TypeScript verification verified with 0 errors.

### 4. Claude / Anthropic Startup Program Roadmap

- Planned integration of Claude API for:
  - Real-time comment sentiment and buyer intent categorization.
  - Creator comment executive summary reports.
  - Contextual auto-replies for comments and direct messages in Hinglish and regional languages.
