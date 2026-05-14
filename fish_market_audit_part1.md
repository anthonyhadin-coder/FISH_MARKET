# 🐟 Fish Market Monorepo — Full Production Audit
## PART 1: Architecture, Flow & Entry Points

---

## 1. Application Architecture Overview

This is what your app looks like from the sky:

```
Browser (User)
    │
    ▼
Next.js Frontend (Port 3000)
    │  • Renders UI pages
    │  • Reads the fm_role cookie to protect routes
    │  • Calls the backend via Axios (with HttpOnly cookies for auth)
    │
    ▼
Express.js Backend (Port 5000)
    │  • REST API — all routes prefixed /api/
    │  • Validates JWT from HttpOnly cookie on every protected request
    │  • Rate limiting + Helmet security headers
    │
    ├──▶ MySQL Database  (fish_market)
    │       Tables: users, boats, sales, expenses,
    │               boat_payments, buyers, buyer_transactions,
    │               voice_logs, staff, staff_salaries, shared_slips
    │
    └──▶ Redis (optional)
            Used ONLY as a JWT denylist (token blocklist on logout)
            Falls back gracefully to in-memory Map if Redis is absent
```

### Supporting Services
| Service | Purpose | Required? |
|---|---|---|
| MySQL | Primary database | ✅ Required |
| Redis | JWT denylist after logout | ⚠️ Optional (has fallback) |
| Firebase | Push notifications (FCM) | ⚠️ Optional |
| Google OAuth | Google Sign-In | ⚠️ Optional |
| Sentry | Error monitoring | ⚠️ Optional |

---

## 2. End-to-End Request Flow

Here is what happens from the moment a user opens the app to data appearing on screen:

### Step 1 — Browser opens the app
```
User visits http://yourdomain.com
    │
    ▼
Next.js middleware (src/proxy.ts) runs FIRST
    • Reads the fm_role cookie
    • If no cookie → redirect to /login
    • If wrong role → redirect to correct dashboard
    • If correct → allow through
```

### Step 2 — Page loads & session verified
```
layout.tsx renders providers (AuthContext, LanguageContext, ToastProvider)
    │
    ▼
AuthContext.tsx (src/contexts/AuthContext.tsx)
    • Checks localStorage for a cached user object
    • Sends GET /api/auth/me to the backend
    • If cookie valid → sets user state
    • If cookie expired → clears state → redirects to /login
```

### Step 3 — User logs in (credential flow)
```
/login page → LoginForm
    │
    ▼
POST /api/auth/login  (backend)
    │  • Validates phone + password
    │  • Checks bcrypt hash in MySQL
    │  • Issues JWT access_token (15 min) + refresh_token (7 days)
    │  • Sets both as HttpOnly cookies
    │  • Returns user object
    │
    ▼
AuthContext.login() called
    • Saves user to localStorage
    • Writes fm_role=agent|owner to a regular (non-HttpOnly) cookie
      (this cookie is readable by the Next.js middleware for routing)
    • Redirects to /agent or /owner dashboard
```

### Step 4 — Agent records a sale
```
Agent Dashboard (AgentView.tsx / EntryTab.tsx)
    │
    ▼ (optional) Voice input
useSpeechRecognition.ts  →  voiceParser.ts
    • Listens to microphone
    • Tamil/English NLP: detects fish name, weight, rate, buyer
    • Returns structured ParsedVoiceResult
    • Auto-fills the sale form
    │
    ▼
POST /api/sales  (backend: modules/agent/sales.ts)
    │  • Auth middleware verifies JWT cookie
    │  • Zod validates body
    │  • Writes to sales table in MySQL
    │
    ▼
Response → UI updates → Toast notification shown
```

### Step 5 — Owner views reports
```
Owner Dashboard (OwnerView.tsx → ReportsTab.tsx)
    │
    ▼
GET /api/reports/...  (backend: modules/owner/reports.ts)
    │  • Complex SQL JOINs across sales, expenses, boats, users
    │  • Returns aggregated JSON
    │
    ▼
Frontend renders recharts charts + PDF export (jsPDF)
```

### Step 6 — Token refresh (silent)
```
Any API call returns 401
    │
    ▼
api.ts interceptor catches it
    │  • Sends POST /api/auth/refresh
    │  • Backend issues new access_token cookie
    │  • Retries the original request transparently
    │  • If refresh also fails → fires auth:unauthorized event
    │  • AuthContext listens → clears state → redirects to /login
```

---

## 3. Entry Point Analysis

### Frontend Entry Points

| File | Role | Type |
|---|---|---|
| `apps/frontend/src/app/layout.tsx` | Root layout — wraps ALL pages with providers | **CORE RUNTIME** |
| `apps/frontend/src/proxy.ts` | Next.js middleware — route protection | **CORE RUNTIME** |
| `apps/frontend/src/app/page.tsx` | Home/landing page | **CORE RUNTIME** |
| `apps/frontend/src/app/(auth)/login/page.tsx` | Login page | **CORE RUNTIME** |
| `apps/frontend/src/app/(auth)/register/page.tsx` | Register page | **CORE RUNTIME** |
| `apps/frontend/src/app/(dashboard)/agent/page.tsx` | Agent dashboard entry | **CORE RUNTIME** |
| `apps/frontend/src/app/(dashboard)/owner/page.tsx` | Owner dashboard entry | **CORE RUNTIME** |
| `apps/frontend/src/app/globals.css` | Global CSS | **CORE RUNTIME** |
| `apps/frontend/next.config.ts` | Next.js config (Sentry, CSP, standalone) | **CORE RUNTIME** |

### Backend Entry Points

| File | Role | Type |
|---|---|---|
| `apps/backend/src/index.ts` | Express server bootstrap — ALL routes registered here | **CORE RUNTIME** |
| `apps/backend/src/config/db.ts` | MySQL connection pool | **CORE RUNTIME** |
| `apps/backend/src/config/redis.ts` | Redis + in-memory fallback for JWT denylist | **CORE RUNTIME** |
| `apps/backend/src/config/validateEnv.ts` | Crashes server if required env vars missing | **CORE RUNTIME** |
| `apps/backend/src/config/sentry.ts` | Sentry error monitoring init | **CORE RUNTIME** |
| `apps/backend/src/middleware/auth.ts` | JWT verification middleware — protects every route | **CORE RUNTIME** |
| `apps/backend/src/middleware/errors.ts` | Global error handler | **CORE RUNTIME** |

### Providers & Contexts (Frontend)

| File | What it provides |
|---|---|
| `AuthContext.tsx` | `user`, `login()`, `logout()`, `isLoading` — used by almost every page |
| `LanguageContext.tsx` | Tamil/English language toggle |
| `NotificationContext.tsx` | Push notification state |
| `GoogleAuthProvider.tsx` | Wraps `@react-oauth/google` for Google Sign-In |
| `Toast.tsx` (ToastProvider) | Global toast notification system |

---

## 4. Full Dependency Tree

### Page → Component → Hook → API → Backend → Database

#### Agent: Recording a Sale
```
/agent (page.tsx)
  └─ AgentView.tsx
       └─ EntryTab.tsx
            ├─ useSpeechRecognition.ts  ← voice input
            │    └─ lib/voice/voiceParser.ts
            │         ├─ fishDetector.ts
            │         ├─ fishPatterns.ts
            │         ├─ tamilNumberParser.ts
            │         └─ fuzzyMatch.ts
            ├─ VoiceInput.tsx (component)
            ├─ lib/api/agentApi.ts
            │    └─ lib/api/api.ts (Axios instance)
            │         └─ POST /api/sales
            │              └─ modules/agent/sales.ts
            │                   └─ MySQL: sales table
            └─ contexts/AuthContext.tsx (reads user.id)
```

#### Owner: Viewing Reports
```
/owner (page.tsx)
  └─ OwnerView.tsx
       └─ ReportsTab.tsx
            ├─ lib/api/ownerApi.ts
            │    └─ lib/api/api.ts
            │         └─ GET /api/reports/...
            │              └─ modules/owner/reports.ts
            │                   └─ MySQL: JOIN sales + expenses + boats
            ├─ recharts (charts library)
            └─ lib/pdfService.ts (PDF export via jsPDF)
```

#### Auth: Login Flow
```
/login (page.tsx)
  └─ LoginForm component
       ├─ lib/api/api.ts
       │    └─ POST /api/auth/login
       │         └─ modules/auth/auth.ts
       │              ├─ MySQL: users table (bcrypt verify)
       │              ├─ jsonwebtoken (sign access + refresh)
       │              └─ Set HttpOnly cookies
       ├─ GoogleAuthButton.tsx
       │    └─ useGoogleAuth.ts
       │         └─ POST /api/auth/google
       │              └─ google-auth-library (verify ID token)
       └─ contexts/AuthContext.tsx (login() → redirect)
```

#### Database Schema Summary
```
users ──────────┬─── boats ──────────┬─── sales
                │                    ├─── expenses
                │                    ├─── boat_payments
                │                    └─── shared_slips
                ├─── staff ──────────── staff_salaries
                └─── voice_logs

buyers ─────────── buyer_transactions ─── sales
```

---

*Continue to Part 2: File Classification (Runtime vs Dev vs Generated vs Dead Code)*
