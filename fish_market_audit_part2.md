# 🐟 Fish Market Monorepo — Full Production Audit
## PART 2: File Classification, Cleanup & Duplicate Detection

---

## 5. Runtime-Critical Files

> These files MUST exist for the app to start and run. Do NOT touch them.

### Backend — Must Have

| File | Why It's Critical |
|---|---|
| `apps/backend/src/index.ts` | Starts the Express server, registers all routes |
| `apps/backend/src/config/db.ts` | MySQL connection — nothing works without this |
| `apps/backend/src/config/redis.ts` | JWT denylist — logout security depends on this |
| `apps/backend/src/config/validateEnv.ts` | Prevents silent misconfig bugs at startup |
| `apps/backend/src/config/sentry.ts` | Error reporting — safe to remove if Sentry not used |
| `apps/backend/src/config/firebase.ts` | Push notification init — needed if FCM is used |
| `apps/backend/src/middleware/auth.ts` | JWT verification — ALL protected routes need this |
| `apps/backend/src/middleware/errors.ts` | Catches all unhandled errors — prevents server crash |
| `apps/backend/src/middleware/validation.ts` | Input validation middleware |
| `apps/backend/src/modules/auth/auth.ts` | Login, register, Google OAuth, refresh, logout |
| `apps/backend/src/modules/agent/sales.ts` | Core sales recording — main feature of the app |
| `apps/backend/src/modules/agent/buyers.ts` | Buyer management |
| `apps/backend/src/modules/agent/voice.ts` | Voice log save endpoint |
| `apps/backend/src/modules/owner/boats.ts` | Boat CRUD |
| `apps/backend/src/modules/owner/reports.ts` | All report queries — owner's main feature |
| `apps/backend/src/modules/owner/admin.ts` | User/boat admin operations |
| `apps/backend/src/modules/owner/expenses.ts` | Expense recording |
| `apps/backend/src/modules/owner/payments.ts` | Boat payment recording |
| `apps/backend/src/modules/owner/salaries.ts` | Staff salary management |
| `apps/backend/src/modules/owner/slips.ts` | Shared slip send/receive |
| `apps/backend/src/modules/notifications/notifications.ts` | Push notification endpoints |
| `apps/backend/src/modules/beta/feedback.ts` | Beta feedback endpoint |
| `apps/backend/src/utils/logger.ts` | Logging utility used everywhere |
| `apps/backend/src/utils/audioValidator.ts` | Validates audio input for voice endpoint |
| `apps/backend/src/models/types.ts` | TypeScript model types |
| `apps/backend/src/services/push.service.ts` | Web Push sending logic |

### Frontend — Must Have

| File | Why It's Critical |
|---|---|
| `apps/frontend/src/app/layout.tsx` | Root layout wrapping ALL pages |
| `apps/frontend/src/proxy.ts` | Next.js middleware — route protection |
| `apps/frontend/src/app/globals.css` | Base styles |
| `apps/frontend/src/app/page.tsx` | Landing/home page |
| `apps/frontend/src/app/(auth)/login/` | Login flow |
| `apps/frontend/src/app/(auth)/register/` | Register flow |
| `apps/frontend/src/app/(auth)/forgot-password/` | Password reset |
| `apps/frontend/src/app/(dashboard)/agent/` | Agent dashboard |
| `apps/frontend/src/app/(dashboard)/owner/` | Owner dashboard |
| `apps/frontend/src/app/error.tsx` | Error boundary |
| `apps/frontend/src/app/not-found.tsx` | 404 page |
| `apps/frontend/src/contexts/AuthContext.tsx` | Authentication state for whole app |
| `apps/frontend/src/contexts/LanguageContext.tsx` | Language switching |
| `apps/frontend/src/contexts/NotificationContext.tsx` | Push notification state |
| `apps/frontend/src/lib/api/api.ts` | Axios instance with interceptors |
| `apps/frontend/src/lib/api/agentApi.ts` | Agent-specific API calls |
| `apps/frontend/src/lib/api/ownerApi.ts` | Owner-specific API calls |
| `apps/frontend/src/lib/api/adminApi.ts` | Admin API calls |
| `apps/frontend/src/lib/voice/voiceParser.ts` | Main voice NLP engine |
| `apps/frontend/src/lib/voice/fishDetector.ts` | 5-layer fish name detection |
| `apps/frontend/src/lib/voice/fishPatterns.ts` | Fish name pattern database |
| `apps/frontend/src/lib/voice/tamilNumberParser.ts` | Tamil number word parser |
| `apps/frontend/src/lib/voice/fuzzyMatch.ts` | Fuzzy string matching |
| `apps/frontend/src/lib/i18n.ts` | Tamil/English translations (18KB) |
| `apps/frontend/src/lib/offlineStorage.ts` | IndexedDB offline queue |
| `apps/frontend/src/lib/pdfService.ts` | PDF export for slips/reports |
| `apps/frontend/src/lib/firebase.ts` | Firebase client init |
| `apps/frontend/src/hooks/useSpeechRecognition.ts` | Microphone + voice stream |
| `apps/frontend/src/hooks/usePushNotifications.ts` | Push subscription |
| `apps/frontend/src/hooks/useGoogleAuth.ts` | Google OAuth flow |
| `apps/frontend/src/hooks/useFormErrors.ts` | Form validation errors |
| `apps/frontend/src/components/voice/VoiceInput.tsx` | Voice recording UI |
| `apps/frontend/src/components/voice/VoiceGuideModal.tsx` | Voice help modal |
| `apps/frontend/src/components/shared/DashboardLayout.tsx` | Shared nav/layout |
| `apps/frontend/src/components/shared/SendToOwnerButton.tsx` | Slip sharing UI |
| `apps/frontend/src/components/shared/OwnerReportsInbox.tsx` | Owner slip inbox |
| `apps/frontend/src/components/beta/FeedbackWidget.tsx` | Beta feedback button |
| `apps/frontend/src/components/ui/Toast.tsx` | Toast notifications |
| `apps/frontend/next.config.ts` | Next.js build config |
| `apps/frontend/tailwind.config.ts` | Tailwind CSS config |

### Shared Packages — Must Have

| File | Why It's Critical |
|---|---|
| `packages/shared-types/src/index.ts` | TypeScript types shared by both frontend and backend |
| `packages/tsconfig/` | Shared TypeScript config |
| `packages/eslint-config/` | Shared ESLint config |

### Deployment — Must Have

| File | Why It's Critical |
|---|---|
| `apps/backend/Dockerfile` | Docker image for backend |
| `apps/frontend/Dockerfile` | Docker image for frontend |
| `infrastructure/docker/docker-compose.yml` | Spins up DB + Redis |
| `.github/workflows/ci.yml` | CI pipeline (lint + test + E2E) |
| `.github/workflows/deploy.yml` | Deployment workflow |
| `turbo.json` | TurboRepo task pipeline |
| `package.json` (root) | Workspace definition |

---

## 6. Development-Only Files

> These are needed locally or in CI, but are NOT shipped to production users.

| File | Purpose | Safe for Prod? |
|---|---|---|
| `apps/backend/src/scripts/initDb.ts` | Creates tables + seeds test data | Dev/CI only |
| `apps/backend/src/db/seed.ts` | Seed data helper | Dev only |
| `apps/backend/src/config/migrate.ts` | Old migration runner | Dev/one-time use |
| `apps/backend/src/db/migrations/*.sql` | SQL migration files | Applied once, then historical |
| `apps/frontend/sentry.client.config.ts` | Sentry browser config | Needed for prod monitoring |
| `apps/frontend/sentry.server.config.ts` | Sentry server config | Needed for prod monitoring |
| `apps/frontend/sentry.edge.config.ts` | Sentry edge config | Needed for prod monitoring |
| `apps/frontend/scripts/` | Frontend utility scripts | Dev only |
| `infrastructure/scripts/cleanup.ps1` | Windows cleanup helper | Dev only |
| `infrastructure/scripts/cleanup.sh` | Linux cleanup helper | Dev only |
| `.github/SECRETS_TEMPLATE.md` | Documents required secrets | Documentation only |

---

## 7. Test-Only Files

> These run in CI but are never executed in production.

| File | Type |
|---|---|
| `apps/frontend/tests/e2e/*.spec.ts` | Playwright E2E tests |
| `apps/frontend/tests/e2e/visual.test.ts` | Visual snapshot tests |
| `apps/frontend/tests/e2e/accessibility.test.ts` | Axe accessibility tests |
| `apps/frontend/tests/auth.setup.ts` | E2E auth setup helper |
| `apps/frontend/src/tests/setup.ts` | Vitest setup |
| `apps/frontend/src/lib/offlineStorage.test.ts` | Offline storage unit tests |
| `apps/frontend/src/lib/voice/voiceParser.test.ts` | Voice parser unit tests |
| `apps/frontend/src/lib/voice/voiceIntegration.test.ts` | Voice integration tests |
| `apps/frontend/src/lib/voice/strictVoiceParser.test.ts` | Strict parser tests |
| `apps/backend/src/modules/agent/sales.test.ts` | Sales module tests |
| `apps/backend/src/db/db-integrity.test.ts` | DB integrity tests |
| `apps/frontend/playwright.config.ts` | Playwright configuration |
| `apps/frontend/vitest.config.ts` | Vitest configuration |
| `apps/backend/vitest.config.ts` | Vitest configuration |
| `apps/backend/src/scripts/check_auth.ts` | Auth debugging script |
| `apps/backend/src/scripts/check_google_auth.ts` | Google auth debug script |

---

## 8. Generated & Cache Files

> These are auto-generated. They should be in `.gitignore` and are SAFE TO DELETE locally.

| File/Folder | What Generates It | Safe to Delete Locally? |
|---|---|---|
| `apps/frontend/.next/` | `next build` | ✅ YES — regenerated on build |
| `apps/backend/dist/` | `tsc` (TypeScript compiler) | ✅ YES — regenerated on build |
| `apps/backend/tsconfig.tsbuildinfo` | TypeScript incremental build | ✅ YES |
| `apps/frontend/tsconfig.tsbuildinfo` | TypeScript incremental build | ✅ YES |
| `apps/frontend/playwright-report/` | Playwright test runs | ✅ YES |
| `apps/frontend/test-results/` | Playwright test runs | ✅ YES |
| `test-results/` (root) | Playwright test runs | ✅ YES |
| `apps/frontend/tests/e2e/visual.test.ts-snapshots/` | Playwright `--update-snapshots` | ⚠️ Keep in git (baseline) |
| `apps/frontend/tests/e2e/analytics_visual.spec.ts-snapshots/` | Playwright snapshots | ⚠️ Keep in git (baseline) |
| `.turbo/` (root + per-app) | TurboRepo task cache | ✅ YES — regenerated |
| `apps/backend/lint_errors.txt` | Manual lint run output | ✅ YES — not needed |
| `apps/backend/lint_results.json` | Manual lint run output | ✅ YES — not needed |
| `apps/frontend/tsc_output.txt` | Manual tsc run output | ✅ YES — not needed |
| `tree.txt` (root) | Manual `tree` command output | ✅ YES — not needed |

---

## 9. Safe Cleanup Candidates

> For every item: Why it exists, what it affects, and the risk level.

---

### 🟢 SAFE — Delete with zero risk

#### `apps/backend/lint_errors.txt` (4.2 KB)
- **Why it exists:** Someone ran ESLint manually and saved the output to a file
- **Affects production:** ❌ No
- **Affects development:** ❌ No (run `npm run lint` to regenerate)
- **Affects testing:** ❌ No
- **Risk:** **SAFE**
- **Why removable:** Pure output artifact, not a source file

#### `apps/backend/lint_results.json` (96 KB)
- **Why it exists:** Same — manual ESLint run with JSON output
- **Affects production:** ❌ No
- **Risk:** **SAFE**
- **Why removable:** 96KB of auto-generated output that belongs in `.gitignore`

#### `apps/frontend/tsc_output.txt` (5.9 KB)
- **Why it exists:** Manual TypeScript check was run and output was redirected to a file
- **Affects production:** ❌ No
- **Risk:** **SAFE**
- **Why removable:** Output artifact, not source code

#### `tree.txt` (root, 56 KB)
- **Why it exists:** Someone ran the `tree` command to document the structure
- **Affects production:** ❌ No
- **Risk:** **SAFE**
- **Why removable:** Informational snapshot — the actual filesystem is the source of truth

#### `apps/backend/.turbo/` folder
- **Why it exists:** TurboRepo task cache (stores hashes of completed tasks)
- **Affects production:** ❌ No
- **Risk:** **SAFE**
- **Why removable:** Fully regenerated by Turbo on next run

#### `apps/frontend/.turbo/` folder
- Same as above. **SAFE**

#### `/tmp/test_parse_voice.js` (visible in open documents)
- **Why it exists:** A scratch test file created during debugging
- **Affects production:** ❌ No
- **Risk:** **SAFE** — it's in `/tmp` not in the repo

---

### 🟡 LOW RISK — Can delete, but verify first

#### `apps/backend/src/core/` (empty directory)
- **Why it exists:** Likely planned for future "core" abstraction layer that was never built
- **Affects production:** ❌ No
- **Affects development:** ❌ No (nothing imports from it — it's empty)
- **Risk:** **LOW RISK**
- **Why removable:** Empty folder with no files

#### `apps/backend/tests/` (empty directory)
- **Why it exists:** Intended location for backend tests, but tests were placed in `src/tests/` and `src/modules/` instead
- **Affects production:** ❌ No
- **Risk:** **LOW RISK**
- **Why removable:** Empty — actual tests live in `src/modules/agent/sales.test.ts` and `src/db/db-integrity.test.ts`

#### `apps/frontend/src/tests/` (contains only `setup.ts`)
- **Why it exists:** Vitest setup file
- **Affects production:** ❌ No
- **Affects testing:** ✅ Yes — `setup.ts` is referenced by `vitest.config.ts`
- **Risk:** **DO NOT DELETE** — needed for test configuration

#### `apps/backend/src/scripts/alter_phone.ts` (343 bytes)
- **Why it exists:** One-time migration to alter the phone column
- **Affects production:** ❌ No
- **Affects development:** ❌ No (already applied to DB)
- **Risk:** **LOW RISK**
- **Why removable:** One-time script, already executed. Archive it instead of delete.

#### `apps/backend/src/scripts/migrate_status.ts` (455 bytes)
- **Why it exists:** One-time script to migrate a status column
- **Risk:** **LOW RISK** — archive-worthy, not delete

#### `apps/backend/src/scripts/migrateSales.ts` (1.2 KB)
- **Why it exists:** One-time data migration for sales table
- **Risk:** **LOW RISK** — archive after verifying it was applied

#### `apps/backend/src/scripts/migrate_shared_slips.ts` (1.2 KB)
- Same pattern. **LOW RISK**

#### `apps/backend/src/scripts/forgot_password_migration.ts` (691 bytes)
- Same pattern. **LOW RISK**

#### `apps/backend/src/scripts/run_google_mig.ts` (1.3 KB)
- Same pattern. **LOW RISK**

#### `infrastructure/scripts/generate_pptx.py` (24 KB)
- **Why it exists:** Python script to generate a PowerPoint presentation (likely for pitching/demo)
- **Affects production:** ❌ No
- **Affects development:** ❌ No
- **Risk:** **LOW RISK**
- **Why removable:** Utility script unrelated to the app runtime. Move to a `docs/` or `presentations/` folder.

#### `apps/backend/src/scripts/unlock.ts` (892 bytes)
- **Why it exists:** Unlocks a locked account in the database (manual admin tool)
- **Affects production:** ❌ No (not imported by anything)
- **Risk:** **LOW RISK** — useful to keep for emergencies but not part of runtime

#### `apps/backend/src/scripts/wipeDb.ts` (908 bytes)
- **Why it exists:** Wipes the entire database — for local dev reset
- **Affects production:** ❌ No
- **Risk:** **LOW RISK** for deletion. **HIGH RISK** if accidentally run on production DB.
- **Recommendation:** Keep locally, add a production guard check (already has one in `initDb.ts`)

#### `apps/frontend/src/lib/fishData.ts` (892 bytes)
- **Why it exists:** Likely a static list of fish names or prices
- **Risk:** **LOW RISK** — verify nothing imports it before deleting

#### `apps/frontend/src/lib/fishUtils.ts` (530 bytes)
- **Why it exists:** Fish utility functions
- **Risk:** **LOW RISK** — verify imports before deleting

#### `apps/frontend/src/lib/whatsapp.ts` (936 bytes)
- **Why it exists:** WhatsApp sharing utility
- **Risk:** **LOW RISK** — verify if any component uses it

---

### 🟠 MEDIUM RISK — Investigate before touching

#### `apps/backend/src/scripts/optimizeDb.ts` (3.8 KB)
- **Why it exists:** Adds performance indexes and optimizes the database
- **Affects production:** ✅ Yes — could be needed after a schema change
- **Risk:** **MEDIUM RISK**
- **Recommendation:** Keep. Could be re-run if performance degrades.

#### `apps/backend/src/scripts/check_auth.ts` (5.1 KB)
- **Why it exists:** Debugging tool to verify auth flow
- **Affects development:** ✅ Useful for debugging
- **Risk:** **MEDIUM RISK** — do not delete; it's a valuable debugging script

#### `apps/frontend/src/lib/loginTranslations.ts` (9 KB)
- **Why it exists:** Translation strings specifically for the login page
- **Risk:** **MEDIUM RISK** — check if `i18n.ts` already contains all these strings (possible duplicate)

#### `apps/frontend/src/lib/voice/strictVoiceParser.ts` (10.4 KB)
- **Why it exists:** A stricter, alternative version of the voice parser
- **Risk:** **MEDIUM RISK** — verify if anything imports this vs `voiceParser.ts`
- **Possible duplicate:** Could be superseded by `voiceParser.ts`

#### `apps/frontend/src/lib/voice/voiceQueue.ts` (1 KB)
- **Why it exists:** A queue for processing voice inputs sequentially
- **Risk:** **MEDIUM RISK** — verify if `VoiceInput.tsx` or `useSpeechRecognition.ts` imports this

---

### 🔴 DO NOT DELETE

| File | Reason |
|---|---|
| `apps/backend/src/scripts/initDb.ts` | Used by CI to initialize the test database |
| `apps/backend/src/db/migrations/*.sql` | Historical record of schema changes |
| `apps/frontend/tests/e2e/*-snapshots/` | Playwright visual regression baselines |
| `.env.example` | Documents all required environment variables |
| `.env.production` | Production environment template |
| `apps/backend/src/db/seed.ts` | Used by initDb for test data |
| `apps/frontend/src/tests/setup.ts` | Vitest global setup |
| `packages/shared-types/` | Shared between frontend AND backend |
| `infrastructure/docker/` | Production deployment |
| `.github/workflows/` | CI/CD pipeline |

---

## 10. Duplicate Architecture Detection

These are areas where similar logic appears in multiple places. They are **not bugs**, but are opportunities for future refactoring.

### 10a. Duplicate Report Systems

| Location | What it does |
|---|---|
| `apps/frontend/src/app/(dashboard)/agent/_components/ReportsTab.tsx` | Agent's view of their own sales reports |
| `apps/frontend/src/app/(dashboard)/owner/_components/ReportsTab.tsx` | Owner's consolidated reports view |
| `apps/frontend/src/app/(dashboard)/owner/_components/BoatReportsTab.tsx` | Owner's per-boat breakdown |
| `apps/backend/src/modules/owner/reports.ts` (29 KB!) | **All report SQL lives here** |

**Observation:** The `reports.ts` file is 29KB — very large. It handles many different report types in one file. This is not broken, but could be split into `salesReports.ts`, `expenseReports.ts`, `boatReports.ts` in the future for maintainability.

### 10b. Duplicate Weekly Report Components

| File | What it does |
|---|---|
| `apps/frontend/src/app/(dashboard)/agent/_components/AgentBoatWeeklyReport.tsx` | Weekly report for agent view |
| `apps/frontend/src/app/(dashboard)/owner/_components/OwnerBoatWeeklyReport.tsx` | Weekly report for owner view |

**Observation:** These two components likely render the same data structure but from different API endpoints. Could be merged into one shared component with a `role` prop.

### 10c. Duplicate Voice Parser Files

| File | Size | Status |
|---|---|---|
| `src/lib/voice/voiceParser.ts` | 22 KB | ✅ Main, actively used |
| `src/lib/voice/strictVoiceParser.ts` | 10 KB | ❓ Unclear if used |
| `src/lib/voice/voiceIntegration.test.ts` | 1.8 KB | Tests the integration |

**Observation:** `strictVoiceParser.ts` may be an older or alternative version. Verify imports before deciding.

### 10d. Duplicate Translation Files

| File | Size | Purpose |
|---|---|---|
| `src/lib/i18n.ts` | 18 KB | Main translation dictionary |
| `src/lib/loginTranslations.ts` | 9 KB | Login-specific translations |

**Observation:** Login translations may be a subset of what's already in `i18n.ts`. Check for key overlap.

### 10e. Two Auth Setup Files in Tests

| File | Location |
|---|---|
| `apps/frontend/tests/auth.setup.ts` | Root tests folder |
| `apps/frontend/tests/e2e/auth.setup.ts` | Inside e2e folder |

**Observation:** Two auth setup files exist. The `playwright.config.ts` determines which one is used. The other may be unused.

### 10f. Duplicate `controllers/` Folder

- `apps/backend/src/controllers/` is **empty**
- All business logic went directly into `modules/` instead
- Safe to delete the empty folder

---

*Continue to Part 3: Safe Refactors & Final Minimal Production Structure*
