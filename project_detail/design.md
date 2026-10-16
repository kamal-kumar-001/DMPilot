# UI/UX Design System Document — AutoDM (Instagram Business OS)

## 1. Aesthetic Identity & Design System Philosophy

AutoDM utilizes a **clean, high-trust light aesthetic** (inspired by [Sejda](https://www.sejda.com/) and modern SaaS platforms), combining a warm cream canvas with crisp white cards and a signature emerald-cyan brand gradient:

- **Warm Cream Background Canvas**: `#FAF9F5` (`--bg-app`) — Soft, distraction-free foundation that is easy on the eyes.
- **Crisp Pure White Surfaces**: `#FFFFFF` (`--bg-surface`) — High-contrast card surfaces and interactive containers.
- **Primary Brand Gradient**:
  - `linear-gradient(135deg, #00BB88 0%, #06B6D4 100%)` (`--primary-gradient`)
  - **Mint Emerald (`#00BB88`)**: Primary brand identity, active indicators, and success states.
  - **Cyan Accent (`#06B6D4`)**: Gradient transitions, secondary highlights, and interactive accents.
- **Slate Typography Stack**:
  - **Headings & Titles**: Deep Slate-900 (`#0F172A`, `--text-main`) for crisp legibility and authority.
  - **Body Copy**: Slate-600 (`#475569`, `--text-muted`) for clean readability.
  - **Auxiliary & Hints**: Slate-400 (`#94A3B8`, `--text-subtle`).
- **Crisp Elevation & Borders**:
  - Crisp subtle borders: Slate-200 (`#E2E8F0`, `--border-default`).
  - Soft elevation shadows: `0 1px 3px 0 rgba(0, 0, 0, 0.04)` (`--shadow-card`) with smooth lift on hover (`--shadow-card-hover`).
- **Typography Stack**: Clean sans-serif system stack powered by Google Font `Inter` (`font-sans`).

---

## 2. Centralized CSS Variables & Tokens (`packages/ui/src/index.css`)

All color palettes and elevations are maintained in a **single source of truth** in `packages/ui/src/index.css` and mapped into `packages/ui/src/tailwind.preset.js`:

```css
:root {
  /* Sejda-inspired clean light palette */
  --bg-app: #faf9f5; /* Warm, clean cream/off-white background */
  --bg-surface: #ffffff; /* Crisp pure white card surface */
  --bg-surface-subtle: #f1f5f9; /* Light slate tint for badges/inputs */
  --bg-surface-hover: #f8fafc; /* Soft slate hover */

  /* Brand Primary & Gradient (Emerald to Cyan) */
  --primary: #00bb88;
  --primary-hover: #00a376;
  --primary-gradient: linear-gradient(135deg, #00bb88 0%, #06b6d4 100%);
  --primary-gradient-subtle: linear-gradient(
    135deg,
    rgba(0, 187, 136, 0.08) 0%,
    rgba(6, 182, 212, 0.05) 100%
  );
  --primary-foreground: #ffffff;

  /* Typography */
  --text-main: #0f172a; /* Slate-900: Deep contrast for headings & titles */
  --text-muted: #475569; /* Slate-600: Clean readability for body text */
  --text-subtle: #94a3b8; /* Slate-400: Light hints & dates */

  /* Borders & Dividers */
  --border-default: #e2e8f0; /* Crisp clean card & section borders */
  --border-subtle: #f1f5f9;

  /* Soft Professional Elevation */
  --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.03);
}
```

---

## 3. Mandatory UI/UX Directives & Layout Rules

### Rule 1: Clean White Cards & Soft Elevation

- Replaced dark gaming mesh and heavy neon glow overlays with **crisp white cards** (`bg-white border border-slate-200 shadow-sm`).
- Cards elevate softly on hover (`hover:shadow-md hover:border-emerald-300 transition-all`).

### Rule 2: Signature Brand Gradient Application

- **Buttons (`.btn-gradient`)**: Primary calls-to-action utilize the emerald-to-cyan gradient with a subtle green shadow (`shadow-brand`).
- **Typography (`.text-brand-gradient`)**: Selected key phrases and metrics apply `bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent`.
- **Badges**: Light emerald pill containers (`bg-emerald-50 border border-emerald-200 text-emerald-800`).

### Rule 3: Decluttered Component Directives

- **Noise Overlays Removed**: Obsolete `.noise-overlay` and dark mode defaults removed from root layout.
- **Surge Alert Banner Removed**: Removed disruptive `SurgeAlertBanner` from the creator dashboard in favor of clean inline metrics.
- **Redundant Routes Deleted**: Deleted duplicate `app/dashboard/delivery-logs` and empty `app/monitoring/page.tsx` routes.
- **Follower Analyzer Link Retained**: Preserved the dedicated Follower Analyzer navigation item in the dashboard navigation.

### Rule 4: Mobile PWA Responsive Experience

- Optimized for mobile viewports with touch-friendly paddings and sticky action headers.
- Interactive horizontal scrolling tabs on mobile enforce hidden scrollbars (`scrollbar-none`) and generous edge padding (`px-4 sm:px-8`) so options are never clipped.

---

## 4. Monorepo Shared UI Package (`packages/ui`)

Shared components in `@autodm/ui` implement the Sejda-inspired light theme:

| Component              | Primitive / Framework           | Tokens & Styling                                                                                                                        |
| ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **`<Button>`**         | Custom + Radix Slot             | `default` (emerald-cyan gradient `.btn-gradient`), `secondary` (clean white with slate border), `outline`, `ghost`, `link`.             |
| **`<Input>`**          | Native HTML Input               | Pure white surface (`bg-white border-slate-200 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary/20`).                |
| **`<Textarea>`**       | Native Textarea                 | Clean white multi-line input with light scrollbar and slate border.                                                                     |
| **`<Label>`**          | Native HTML Label               | Crisp slate tracking label (`text-xs font-semibold uppercase tracking-wider text-slate-700`).                                           |
| **`<Dialog>`**         | Radix UI Dialog + Framer Motion | Crisp white modal (`bg-white border-slate-200 text-slate-900 shadow-2xl`) with soft backdrop blur (`bg-slate-900/40 backdrop-blur-sm`). |
| **`<Breadcrumbs>`**    | Custom React Component          | ChevronRight separators, home icon, and active text emerald accent.                                                                     |
| **`<CommandPalette>`** | Custom Keyboard Primitive       | Quick-search dialog triggered via `⌘K` or `Ctrl+K`. Features white search modal and keyboard navigation.                                |
| **`<Toaster>`**        | Sonner Toast                    | Clean toast notification stack with crisp status badges (`#00BB88` success, `#EF4444` error).                                           |
