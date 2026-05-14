# Fish Market Platform - Design System & Architecture Blueprint

## Overview
**App Type:** B2B/B2C Seafood Marketplace & Fleet Management Platform
**Target Users:** Fleet owners (suppliers), wholesale buyers (restaurants/markets), individual consumers, and platform administrators.
**Platform:** Responsive Web App & Dashboard (Desktop & Mobile)
**Design Style:** Modern, Minimal, Clean, Premium, Apple-level polish, High conversion focused
**Color Style:** Both (Light & Dark Mode Support)
**Primary Goal:** Streamline the seafood supply chain by connecting boat owners directly with buyers, managing catch reports in real-time, and facilitating seamless, fresh seafood transactions.

---

## 1. DESIGN SYSTEM

### Colors
**Primary Palette:**
- **Primary (Ocean Blue):** `#0066FF` (Trust, freshness, primary actions)
- **Primary Hover:** `#0052CC`
- **Secondary (Teal):** `#00B3A6` (Accents, secondary actions, freshness)

**Neutral Palette:**
- **Background (Light):** `#FFFFFF`
- **Surface (Light):** `#F8FAFC`
- **Background (Dark):** `#0F172A`
- **Surface (Dark):** `#1E293B`
- **Text Primary:** `#0F172A` (Light mode) / `#F8FAFC` (Dark mode)
- **Text Secondary:** `#64748B` (Light mode) / `#94A3B8` (Dark mode)
- **Borders:** `#E2E8F0` (Light) / `#334155` (Dark)

**Semantic Colors:**
- **Success (Green):** `#10B981` (Completed orders, successful payments)
- **Warning (Yellow):** `#F59E0B` (Low stock, delayed ships)
- **Error (Red):** `#EF4444` (Failed payments, system alerts)

### Typography
- **Primary Font:** `Inter` (Clean, highly legible for data-dense dashboards)
- **Display Font:** `Outfit` (Modern, geometric for marketing headers)
- **Hierarchy:**
  - `h1`: 48px, Bold, Outfit
  - `h2`: 32px, SemiBold, Outfit
  - `h3`: 24px, SemiBold, Inter
  - `Body Large`: 18px, Regular, Inter
  - `Body Regular`: 16px, Regular, Inter
  - `Small Text`: 14px, Medium, Inter
  - `Micro Text`: 12px, Regular, Inter (Tags, metadata)

### Spacing & Grid System
- **Base Unit:** 4px (4, 8, 12, 16, 24, 32, 48, 64)
- **Grid System:** 12-column fluid grid
- **Gutter:** 24px (Desktop), 16px (Mobile)
- **Max Width:** 1440px

### Component Styling
- **Border Radius:** `8px` (Inputs, Small Cards), `12px` (Standard Cards), `9999px` (Pills/Badges)
- **Shadows (Light Mode):**
  - Small: `0 1px 3px rgba(0,0,0,0.1)`
  - Medium (Cards): `0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)`
  - Large (Modals/Dropdowns): `0 20px 25px -5px rgba(0,0,0,0.1)`
- **Glassmorphism:** Used sparingly on floating navigation and premium data-cards (e.g., `backdrop-filter: blur(12px); background: rgba(255,255,255,0.7)`).
- **Animations:** Subtle, purposeful. `200ms ease-in-out` for hover states. Page transitions use `300ms cubic-bezier(0.4, 0, 0.2, 1)`.

---

## 2. COMPLETE APP INFORMATION ARCHITECTURE

### Role-Based Access
1. **Customer (B2C/B2B):** Browsing inventory, purchasing, order tracking.
2. **Owner (Supplier/Fleet Manager):** Boat management, catch reports, pricing, inventory.
3. **Admin:** Platform oversight, user management, system health.

### Sitemap & User Flow
- **Public / Auth:** Splash -> Login/Register -> OTP Verification -> Onboarding
- **Customer Flow:** Home -> Search/Filter Marketplace -> Product Detail -> Cart -> Checkout -> Order Success -> Profile/Order History
- **Owner Flow:** Dashboard -> Boat Management -> Catch Reports -> Inventory Management -> Revenue Analytics -> Settings
- **Admin Flow:** Admin Dashboard -> User Management -> Fleet Oversight -> Dispute Resolution -> System Settings

---

## 3. APP SCREENS

### Auth Screens
*   **Login/Signup:**
    *   *Layout:* Split screen (Desktop: Image left, form right. Mobile: Stacked).
    *   *Components:* Social auth buttons, clean inputs, OTP modal.
    *   *Empty/Loading:* Skeleton loader on form submission.

### Customer Screens (Marketplace)
*   **Home Dashboard (Customer):**
    *   *Purpose:* Discover fresh catches.
    *   *Layout:* Hero banner, horizontal scroll categories, grid of "Today's Catch".
    *   *Components:* Search bar, filtering tags, product cards.
*   **Product Detail:**
    *   *Layout:* High-res image gallery, sticky buy box on right.
    *   *UX Behavior:* Add to cart triggers a sliding side-drawer cart.

### Owner Screens (Dashboard)
*   **Owner Dashboard:**
    *   *Purpose:* High-level overview of fleet operations and sales.
    *   *Components:* KPI Cards (Revenue, Active Boats), Revenue Chart, Recent Orders Table.
*   **Boat Reports Tab (`/owner/_components/BoatReportsTab`):**
    *   *Purpose:* Log and review daily catch reports.
    *   *Layout:* List/Grid toggle of boats. Expandable accordion for report details.
    *   *Empty State:* "No catch reports for today. Log a new catch." with illustration.

### Admin Screens
*   **Admin Panel (`/admin`):**
    *   *Purpose:* Global oversight.
    *   *Layout:* Persistent left sidebar, top header for global search, main content area.
    *   *Components:* Data tables with pagination, bulk action bars, role-toggles.

---

## 4. COMPONENT LIBRARY

*   **Navigation:** Top Navbar (sticky, glass effect), Sidebar (collapsible, icon + text).
*   **Cards:** 
    *   *Product Card:* Image, Title, Price, "Freshness" Badge, Add to Cart button.
    *   *KPI Card:* Icon, Metric Title, Big Number, Trend indicator (e.g., "+12% this week" in green).
*   **Forms:** Floating label inputs, Search bars with command-palette (Cmd+K).
*   **Tables:** Sticky header, row hover states, status badges (e.g., "Shipped", "Processing").
*   **Feedback:** Toast notifications (top-right), Skeleton loaders (shimmer effect).
*   **Modals:** Centered dialogs with semi-transparent overlay.

---

## 5. ADVANCED UX DETAILS

*   **UX Writing:** Clear, concise. e.g., "Add to Cart" instead of "Purchase". "Catch logged successfully" instead of "Data saved".
*   **Empty-State Messaging:** "Your cart is feeling a bit light. Let's catch some fresh deals!"
*   **Error Handling:** Inline validation before submission. "Oops! Looks like that boat name is already taken."
*   **Conversion Optimization:** Sticky checkout buttons on mobile, one-click reordering for B2B buyers.
*   **Micro-interactions:** Heart icon bubbles when favoriting an item. Smooth number counter animation on KPI cards on load.

---

## 6. FRONTEND IMPLEMENTATION STRUCTURE

*   **Framework:** Next.js (App Router) + React
*   **Styling:** Tailwind CSS (configured with Design Tokens) / Vanilla CSS (as per project rules) + Radix UI / Shadcn for headless accessibility.
*   **Folder Structure (Monorepo Turborepo):**
    *   `apps/frontend/src/app` (Next.js routes)
    *   `apps/frontend/src/components` (UI elements)
    *   `packages/shared-types` (TypeScript interfaces)
*   **State Management:** React Context (Global UI state) + React Query (Server state).
*   **Responsive Breakpoints:** `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`

---

## 7. STITCH-READY PAGE GENERATION FORMAT

**JSON Representation for Stitch Generation:**
```json
{
  "page": "OwnerDashboard",
  "layout": "DashboardLayout",
  "sections": [
    {
      "type": "Header",
      "tokens": { "background": "bg-surface-light", "border": "border-b" }
    },
    {
      "type": "KPIWidgetGroup",
      "components": ["RevenueCard", "ActiveBoatsCard", "PendingOrdersCard"]
    },
    {
      "type": "ChartSection",
      "title": "Weekly Sales",
      "component": "LineChart"
    },
    {
      "type": "DataTable",
      "title": "Recent Catch Reports",
      "dataModel": "CatchReport"
    }
  ]
}
```

---

## 8. PREMIUM STARTUP-LEVEL FEATURES

*   **AI-Powered Features:** "Smart Pricing" suggestions based on market demand. "AI Catch Forecasting" based on weather and historical data.
*   **Automation:** Auto-generate invoices for B2B wholesale orders.
*   **Push Notifications:** Real-time alerts when a favorite boat docks with fresh catch.
*   **Engagement:** "Freshness Tracker" – visual timeline of fish from boat to market.

---

## 9. VISUAL DIRECTION

*   **Vibe:** Professional, trustworthy, fresh. 
*   **Inspirations:** Stripe (for the admin/dashboard data tables), Linear (for the issue/catch reporting flow speed), Notion (for clean typography).
*   **Hero Section:** High-quality, moody photography of the ocean/fishing boats overlayed with sharp, legible white typography and a vibrant blue CTA.

---

## 10. VOICE & NLP ARCHITECTURE

*   **Centralized Fish Database:** The single source of truth for all fish metadata, aliases, and pricing profiles is located at `apps/frontend/src/lib/voice/fishPatterns.ts` (`FISH_BY_ID` and `FISH_NAME_INDEX`).
*   **Legacy Architecture Retired:** The redundant `FISH_DICTIONARY` and `KNOWN_FISH` mappings previously found in `voiceParser.ts` and `strictVoiceParser.ts` have been fully removed.
*   **Voice Engine Workflow:** Voice input is transcribed by browser SpeechRecognition and passed to the parsers which validate species names strictly against the master `FISH_NAME_INDEX`. Missing or implicit rates are dynamically computed as averages from the fish's defined `priceRange` in the master pattern file.

---

## 11. BACKEND ARCHITECTURE & DOMAIN SEPARATION

*   **Framework:** Express.js + MySQL2 + Zod.
*   **Domain-Driven Modules:** The API is structured by core domains instead of role-based buckets:
    *   \/auth\: Authentication and role-based login.
    *   \/sales\: Agent entry and catch recording.
    *   \/reports\: Unified financial metrics and analytics using a shared query builder.
    *   \/voice\: Advanced multilingual voice parsing engine.
    *   \/boats\, \/buyers\, \/expenses\, \/payments\, \/salaries\, \/slips\: Domain-specific CRUD entities.
*   **Security & Scalability:**
    *   Strict rate limiting via Redis (or in-memory fallback).
    *   Sentry error tracking.

