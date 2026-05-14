# 🐟 Fish Market Monorepo — Full Production Audit
## PART 3: Safe Refactors & Final Production Structure

---

## 11. Safe Refactor Suggestions

> These are improvements you can make **one at a time**, safely.
> Each one is described simply so you understand what to do and why.

---

### Refactor 1 — Add these files to `.gitignore`

**What:** Several generated/output files are currently tracked by Git. They should not be.

**Why:** They are auto-regenerated, waste storage space in your repo, and cause noisy diffs.

Add these lines to your root `.gitignore`:

```gitignore
# Generated output files (not source code)
apps/backend/lint_errors.txt
apps/backend/lint_results.json
apps/frontend/tsc_output.txt
tree.txt

# TypeScript incremental build info
**/tsconfig.tsbuildinfo

# TurboRepo cache
.turbo/

# Next.js build output
apps/frontend/.next/

# Backend compiled output
apps/backend/dist/

# Test reports
apps/frontend/playwright-report/
apps/frontend/test-results/
test-results/
```

**Risk:** SAFE — does not affect any code.

---

### Refactor 2 — Delete the empty `controllers/` folder

**What:** `apps/backend/src/controllers/` is completely empty.

**Why it exists:** The original plan was to separate route handlers (controllers) from business logic. That pattern was abandoned and everything went directly into `modules/` instead.

**How to delete safely:**
```powershell
Remove-Item -Path "apps\backend\src\controllers" -Recurse
```

**Risk:** SAFE — empty folder, nothing imports from it.

---

### Refactor 3 — Delete the empty `core/` folder

**What:** `apps/backend/src/core/` is completely empty.

**Why it exists:** Planned for future shared backend utilities that were never created.

```powershell
Remove-Item -Path "apps\backend\src\core" -Recurse
```

**Risk:** SAFE — empty folder.

---

### Refactor 4 — Delete the empty backend `tests/` folder

**What:** `apps/backend/tests/` is completely empty.

**Why it exists:** Intended test location that was never used. Actual tests are in `src/modules/` and `src/db/`.

```powershell
Remove-Item -Path "apps\backend\tests" -Recurse
```

**Risk:** SAFE — empty folder.

---

### Refactor 5 — Archive one-time migration scripts

**What:** Move these scripts to an `_archive/` subfolder inside `scripts/` instead of deleting them. This way they are preserved for reference but clearly marked as "done".

Scripts to archive (they were one-time runs):
- `alter_phone.ts`
- `migrate_status.ts`
- `migrateSales.ts`
- `migrate_shared_slips.ts`
- `forgot_password_migration.ts`
- `run_google_mig.ts`

**How:** Create `apps/backend/src/scripts/_archive/` and move them there.

**Risk:** LOW RISK — they are not imported by anything. They are standalone scripts run via `npx tsx`.

---

### Refactor 6 — Clean up generated output files

These files exist in the repo and should be deleted (they will regenerate):

```powershell
# Run from the FISH_MARKET root
Remove-Item "apps\backend\lint_errors.txt"
Remove-Item "apps\backend\lint_results.json"
Remove-Item "apps\frontend\tsc_output.txt"
Remove-Item "tree.txt"
```

**Risk:** SAFE — all are generated output, not source code.

---

### Refactor 7 — Investigate `strictVoiceParser.ts`

**What to do:** Check whether anything imports `strictVoiceParser.ts`.

Run this search in your terminal:
```powershell
Get-ChildItem -Recurse -Include "*.ts","*.tsx" | 
  Select-String "strictVoiceParser" | 
  Select-Object Path, Line
```

**Expected outcomes:**
- If only test files import it → it is test-only, keep it with the tests
- If nothing imports it → it is dead code, safe to delete
- If components import it → it is active, keep it

**Risk:** MEDIUM RISK (investigate before acting)

---

### Refactor 8 — Investigate `loginTranslations.ts`

**What to do:** Check if the keys in `loginTranslations.ts` overlap with `i18n.ts`.

```powershell
Get-ChildItem -Recurse -Include "*.ts","*.tsx" | 
  Select-String "loginTranslations" | 
  Select-Object Path, Line
```

If very few files use it and the keys exist in `i18n.ts` already, merge them and delete `loginTranslations.ts`.

**Risk:** MEDIUM RISK (investigate before acting)

---

### Refactor 9 — Consolidate the two Weekly Report components

**What:** `AgentBoatWeeklyReport.tsx` and `OwnerBoatWeeklyReport.tsx` likely share 70%+ of their structure.

**How (future, optional):**
Create `components/shared/BoatWeeklyReport.tsx` that accepts a `role: 'agent' | 'owner'` prop and conditionally shows the right data.

**Risk:** MEDIUM RISK — do this only if you are comfortable with React props. Not urgent.

---

### Refactor 10 — Move `generate_pptx.py` out of infrastructure

**What:** `infrastructure/scripts/generate_pptx.py` is a Python presentation generator — not part of the app infrastructure.

**How:** Move to a `docs/` or `presentations/` folder at the root.

**Risk:** LOW RISK — does not affect the app at all.

---

## 12. Final Minimal Production Structure

> This is what your project looks like after safe cleanup. 
> Items marked ❌ are removed. Items marked ✅ are kept.

```
FISH_MARKET/
├── .env.example                    ✅ KEEP — documents required env vars
├── .env.production                 ✅ KEEP — production env template
├── .gitignore                      ✅ KEEP (+ add entries from Refactor 1)
├── package.json                    ✅ KEEP — workspace root
├── turbo.json                      ✅ KEEP — pipeline config
├── README.md                       ✅ KEEP
├── DESIGN.md                       ✅ KEEP
├── tree.txt                        ❌ DELETE — generated output
│
├── .github/
│   ├── SECRETS_TEMPLATE.md         ✅ KEEP — documentation
│   └── workflows/
│       ├── ci.yml                  ✅ KEEP — CI pipeline
│       └── deploy.yml              ✅ KEEP — deployment
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml      ✅ KEEP — production DB + Redis
│   │   └── docker-compose.test.yml ✅ KEEP — CI test services
│   ├── nginx/                      ✅ KEEP (empty but placeholder is fine)
│   └── scripts/
│       ├── cleanup.ps1             ✅ KEEP — dev utility
│       ├── cleanup.sh              ✅ KEEP — dev utility
│       └── generate_pptx.py       ⚠️ MOVE to /docs/
│
├── packages/
│   ├── shared-types/               ✅ KEEP — critical shared types
│   ├── tsconfig/                   ✅ KEEP
│   └── eslint-config/              ✅ KEEP
│
├── apps/
│   ├── backend/
│   │   ├── Dockerfile              ✅ KEEP
│   │   ├── .env / .env.production  ✅ KEEP
│   │   ├── package.json            ✅ KEEP
│   │   ├── tsconfig.json           ✅ KEEP
│   │   ├── vitest.config.ts        ✅ KEEP
│   │   ├── tsconfig.tsbuildinfo    ❌ DELETE + gitignore
│   │   ├── lint_errors.txt         ❌ DELETE + gitignore
│   │   ├── lint_results.json       ❌ DELETE + gitignore
│   │   ├── dist/                   ❌ gitignore (regenerated by build)
│   │   ├── .turbo/                 ❌ gitignore (cache)
│   │   └── src/
│   │       ├── index.ts            ✅ KEEP — server entry point
│   │       ├── config/
│   │       │   ├── db.ts           ✅ KEEP
│   │       │   ├── redis.ts        ✅ KEEP
│   │       │   ├── firebase.ts     ✅ KEEP
│   │       │   ├── sentry.ts       ✅ KEEP
│   │       │   ├── validateEnv.ts  ✅ KEEP
│   │       │   └── migrate.ts      ✅ KEEP (one-time but harmless)
│   │       ├── middleware/
│   │       │   ├── auth.ts         ✅ KEEP
│   │       │   ├── errors.ts       ✅ KEEP
│   │       │   └── validation.ts   ✅ KEEP
│   │       ├── modules/
│   │       │   ├── auth/auth.ts    ✅ KEEP
│   │       │   ├── agent/
│   │       │   │   ├── sales.ts    ✅ KEEP
│   │       │   │   ├── buyers.ts   ✅ KEEP
│   │       │   │   ├── voice.ts    ✅ KEEP
│   │       │   │   └── sales.test.ts ✅ KEEP (test)
│   │       │   ├── owner/
│   │       │   │   ├── admin.ts    ✅ KEEP
│   │       │   │   ├── boats.ts    ✅ KEEP
│   │       │   │   ├── expenses.ts ✅ KEEP
│   │       │   │   ├── payments.ts ✅ KEEP
│   │       │   │   ├── reports.ts  ✅ KEEP
│   │       │   │   ├── salaries.ts ✅ KEEP
│   │       │   │   └── slips.ts    ✅ KEEP
│   │       │   ├── beta/feedback.ts ✅ KEEP
│   │       │   └── notifications/  ✅ KEEP
│   │       ├── models/types.ts     ✅ KEEP
│   │       ├── services/push.service.ts ✅ KEEP
│   │       ├── utils/
│   │       │   ├── logger.ts       ✅ KEEP
│   │       │   └── audioValidator.ts ✅ KEEP
│   │       ├── db/
│   │       │   ├── seed.ts         ✅ KEEP (CI uses it)
│   │       │   ├── db-integrity.test.ts ✅ KEEP
│   │       │   └── migrations/     ✅ KEEP (historical record)
│   │       ├── scripts/
│   │       │   ├── initDb.ts       ✅ KEEP (CI critical)
│   │       │   ├── optimizeDb.ts   ✅ KEEP (useful tool)
│   │       │   ├── unlock.ts       ✅ KEEP (admin tool)
│   │       │   ├── wipeDb.ts       ✅ KEEP (dev tool)
│   │       │   ├── check_auth.ts   ✅ KEEP (debug tool)
│   │       │   └── _archive/       ⚠️ MOVE one-time scripts here
│   │       ├── controllers/        ❌ DELETE — empty
│   │       ├── core/               ❌ DELETE — empty
│   │       └── tests/              ❌ DELETE — empty
│   │
│   └── frontend/
│       ├── Dockerfile              ✅ KEEP
│       ├── next.config.ts          ✅ KEEP
│       ├── tailwind.config.ts      ✅ KEEP
│       ├── playwright.config.ts    ✅ KEEP
│       ├── vitest.config.ts        ✅ KEEP
│       ├── tsconfig.json           ✅ KEEP
│       ├── package.json            ✅ KEEP
│       ├── postcss.config.mjs      ✅ KEEP
│       ├── tsconfig.tsbuildinfo    ❌ DELETE + gitignore
│       ├── tsc_output.txt          ❌ DELETE + gitignore
│       ├── sentry.*.config.ts      ✅ KEEP (3 files — error monitoring)
│       ├── .next/                  ❌ gitignore
│       ├── .turbo/                 ❌ gitignore
│       ├── playwright-report/      ❌ gitignore
│       ├── test-results/           ❌ gitignore
│       └── src/
│           ├── proxy.ts            ✅ KEEP — middleware
│           ├── app/                ✅ KEEP ALL
│           ├── contexts/           ✅ KEEP ALL
│           ├── hooks/              ✅ KEEP ALL
│           ├── components/         ✅ KEEP ALL
│           └── lib/
│               ├── api/            ✅ KEEP ALL
│               ├── voice/
│               │   ├── voiceParser.ts        ✅ KEEP
│               │   ├── fishDetector.ts       ✅ KEEP
│               │   ├── fishPatterns.ts       ✅ KEEP
│               │   ├── tamilNumberParser.ts  ✅ KEEP
│               │   ├── fuzzyMatch.ts         ✅ KEEP
│               │   ├── voiceQueue.ts         ⚠️ INVESTIGATE
│               │   ├── strictVoiceParser.ts  ⚠️ INVESTIGATE
│               │   └── *.test.ts             ✅ KEEP (tests)
│               ├── i18n.ts         ✅ KEEP
│               ├── loginTranslations.ts ⚠️ INVESTIGATE (possible duplicate)
│               ├── offlineStorage.ts ✅ KEEP
│               ├── pdfService.ts   ✅ KEEP
│               ├── firebase.ts     ✅ KEEP
│               ├── fishData.ts     ⚠️ INVESTIGATE
│               ├── fishUtils.ts    ⚠️ INVESTIGATE
│               └── whatsapp.ts     ⚠️ INVESTIGATE
```

---

## 13. Environment Variables Reference

> All required env vars for the app to work in production.

### Backend (`.env`)
| Variable | Purpose | Required? |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | ✅ Required |
| `REDIS_URL` | Redis for JWT denylist | ⚠️ Optional (has fallback) |
| `JWT_SECRET` | Signs access tokens (min 32 chars) | ✅ Required |
| `REFRESH_TOKEN_SECRET` | Signs refresh tokens (min 32 chars) | ✅ Required |
| `CLIENT_URL` | Frontend URL for CORS | ✅ Required |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | ✅ Required |
| `PORT` | Backend port (default: 5000) | ⚠️ Optional |
| `GOOGLE_CLIENT_ID` | Google OAuth app ID | ⚠️ Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | ⚠️ Optional |
| `VAPID_PUBLIC_KEY` | Web push public key | ⚠️ Optional |
| `VAPID_PRIVATE_KEY` | Web push private key | ⚠️ Optional |
| `FIREBASE_SERVICE_ACCOUNT` | FCM credentials JSON | ⚠️ Optional |
| `SENTRY_DSN` | Sentry error reporting | ⚠️ Optional |

### Frontend (`.env.local`)
| Variable | Purpose | Required? |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (`http://localhost:5000/api`) | ✅ Required |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth (frontend) | ⚠️ Optional |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notification key | ⚠️ Optional |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase config vars | ⚠️ Optional |

---

## 14. Quick-Win Cleanup Checklist

Copy this checklist and tick them off one by one. Start from the top — safest first.

```
IMMEDIATE (Zero Risk):
[ ] Delete apps/backend/lint_errors.txt
[ ] Delete apps/backend/lint_results.json
[ ] Delete apps/frontend/tsc_output.txt
[ ] Delete tree.txt (root)
[ ] Delete apps/backend/src/controllers/  (empty folder)
[ ] Delete apps/backend/src/core/         (empty folder)
[ ] Delete apps/backend/tests/            (empty folder)
[ ] Add generated files to .gitignore     (see Refactor 1 above)

LOW RISK (Verify, then do):
[ ] Move one-time scripts to _archive/ subfolder
[ ] Move generate_pptx.py to /docs/
[ ] Run import search on strictVoiceParser.ts
[ ] Run import search on loginTranslations.ts
[ ] Run import search on fishData.ts, fishUtils.ts, whatsapp.ts

OPTIONAL FUTURE REFACTORS:
[ ] Merge AgentBoatWeeklyReport + OwnerBoatWeeklyReport into one shared component
[ ] Split reports.ts (29KB) into smaller domain files
[ ] Merge loginTranslations.ts into i18n.ts (if duplicate keys confirmed)
```

---

## 15. Summary of What This App Actually Does

For your understanding — the Fish Market app is a **digital ledger system** for the fishing industry with these core features:

| Feature | Who Uses It | Files Involved |
|---|---|---|
| **Record Fish Sales** | Agent | `EntryTab.tsx` → `sales.ts` → MySQL |
| **Voice Entry (Tamil/English)** | Agent | `useSpeechRecognition` → `voiceParser.ts` → NLP |
| **Buyer Balance Tracking** | Agent | `BuyersTab.tsx` → `buyers.ts` → MySQL |
| **Daily Slip Generation** | Agent | `SlipTab.tsx` → `slips.ts` → PDF |
| **Send Slip to Owner** | Agent | `SendToOwnerButton.tsx` → `slips.ts` → FCM push |
| **View Sales Reports** | Owner | `ReportsTab.tsx` → `reports.ts` → SQL JOINs |
| **Boat Management** | Owner | `BoatsTab.tsx` → `boats.ts` → MySQL |
| **Staff Salaries** | Owner | `SalariesTab.tsx` → `salaries.ts` → MySQL |
| **User Administration** | Owner/Admin | `UsersTab.tsx` → `admin.ts` → MySQL |
| **Offline Support** | Both | `offlineStorage.ts` → IndexedDB → Service Worker |
| **Push Notifications** | Both | `push.service.ts` → Firebase FCM |
| **Google Sign-In** | Both | `GoogleAuthButton.tsx` → `google-auth-library` |

---

*End of Full Audit — 3 Parts Total*
*Part 1: Architecture, Flow, Entry Points, Dependency Tree*
*Part 2: File Classification, Cleanup Candidates, Duplicates*
*Part 3: Safe Refactors, Final Structure, Checklist*
