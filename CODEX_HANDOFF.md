# PROJECT HANDOFF DOCUMENT - DEEP OCEAN FISH MARKET

## 1. PROJECT OVERVIEW
* **Project Name**: DEEP OCEAN Fish Market (internal monorepo name: `FISH_MARKET`)
* **Project Purpose**: A secure, bilingual (English/Tamil) digital logistics and financial ledger platform for modernizing daily fish market operations, sales tracking, and boat fleet management.
* **Business Goals**: Eliminate paper-based ledgers, automate agent commission tracking, ensure offline-capable operations at busy docks, and provide real-time financial transparency to boat owners.
* **Target Users**: 
  - Boat Owners (Fleet management, financial overview)
  - Market Agents (Daily sales entry, voice-based rapid logging, slip generation)
  - Buyers (Live auction viewing - stubbed)
* **Key Features**: 
  - Tamil/English bilingual UI
  - Progressive Web App (PWA) with IndexedDB offline-first synchronization
  - NLP Web Worker for voice-to-text sales entry (supports Tamil numerals)
  - Role-Based Access Control (RBAC)
  - Real-time rate limiting, JWT/Cookie authentication

## 2. COMPLETE REQUIREMENTS
* **Functional Requirements**:
  - Secure login via Phone/Password, OTP, or Google OAuth.
  - Agents must be able to log sales via voice dictation or manual form.
  - Agents must generate daily sales slips and weekly reports.
  - Owners must be able to view their boats' performance and agent commissions.
  - The system must function entirely offline and sync pending sales when reconnected.
  - Multilingual support dynamically togglable without page reloads.
* **Non-Functional Requirements**:
  - PWA compliance (installable on mobile devices).
  - High availability and fail-open rate limiting fallbacks.
  - Strict typing (TypeScript) across backend and frontend boundaries.
  - Accessible design following WCAG 2.4.7 guidelines.
* **User Stories**:
  - As an Agent, I want to dictate sales in Tamil so that I don't have to wash my hands to type.
  - As an Owner, I want to see my weekly gross sales so I can calculate profits.
  - As a User, I want to work offline at the docks without losing data.
* **Acceptance Criteria**:
  - 100% test pass rate.
  - 0 TypeScript errors.
  - 0 ESLint warnings.
  - All offline data correctly syncs on reconnect.

## 3. SYSTEM ARCHITECTURE
* **Architecture Explanation**: Turborepo Monorepo containing a Next.js 14 frontend, an Express.js backend, and shared local packages for types and database access.
* **Component Interactions**: Frontend calls Backend via REST API (Axios instance). Backend uses a shared database package to query MySQL. PWA Service Worker intercepts requests for offline caching and background sync.
* **Data Flow**: User Input / Voice -> Frontend State -> IndexedDB (if offline) -> Axios -> Backend Express Controllers -> MySQL.
* **Technology Stack**:
  - Frontend: Next.js 14 (App Router), React, TailwindCSS, Framer Motion, IndexedDB, Lucide Icons.
  - Backend: Node.js, Express, MySQL2, Redis (for rate limiting).
  - Shared: TypeScript, Turborepo, Vitest.
* **Third-party Integrations**: Firebase (Authentication / OTP), Google OAuth.

## 4. DATABASE DESIGN
* **Tables**: `users`, `refresh_tokens`, `boats`, `sales`, `boat_payments`, `commission_rules`
* **Fields & Data Types**:
  - `users`: id (PK), phone (VARCHAR), password_hash (VARCHAR), role (ENUM: 'admin', 'owner', 'agent', 'buyer')
  - `sales`: id (PK), boat_id (FK), fish_name (VARCHAR), weight (DECIMAL), rate (DECIMAL), total (DECIMAL), buyer_id (FK), report_date (DATE)
  - `refresh_tokens`: id, user_id (FK), token_hash, expires_at, revoked
  - `commission_rules`: id, agent_id (FK), base_percentage (DECIMAL), target_amount (DECIMAL), bonus_amount (DECIMAL)
* **Relationships**: Users 1:M Boats (Owners). Boats 1:M Sales. Users 1:M RefreshTokens.
* **Constraints**: Foreign keys cascade on delete. NOT NULL enforcement on core financial fields.
* **ERD Explanation**: The system revolves around `boats`. Sales are tied to a boat, not an agent directly, though agents manage the boats. Finances are derived via aggregating `sales` totals minus the `commission_rules` of the active agent.

## 5. API SPECIFICATION
* **Auth**: `/api/auth/login` (POST), `/api/auth/phone/send-otp` (POST), `/api/auth/google` (POST), `/api/auth/me` (GET), `/api/auth/logout` (POST).
* **Sales**: `/api/sales` (POST - Create sale), `/api/sales/history` (GET - Daily breakdown).
* **Payments**: `/api/boat-payments` (POST - Log payout), `/api/boat-payments` (GET).
* **Reports**: `/api/reports/agent-weekly` (GET - Weekly slip), `/api/reports/owner-dashboard` (GET).
* **Request/Response Format**: JSON.
* **Authentication Method**: HttpOnly cookies (`access_token`, `refresh_token`). JWT payloads.
* **Error Handling**: Standardized ApiError format `{ message: string, errors?: array }` with strict 400, 401, 403, 429 status codes.

## 6. FRONTEND DESIGN
* **Screens**: Landing (`/`), Login (`/login`), Agent Dashboard (`/agent`), Owner Dashboard (`/owner`), Buyer Marketplace (`/customer`).
* **UI Components**: `AuthCard`, `VoiceInput`, `NotificationDropdown`, `RoleSelectModal`, Tab components (`EntryTab`, `SlipTab`, etc.).
* **Navigation Flow**: Auth boundaries enforce redirects. Unauthorized access to `/agent` redirects to appropriate role dashboard.
* **State Management**: React Context (`AuthContext`, `LanguageContext`, `AgentContext`, `NotificationContext`).
* **Responsive Behavior**: Mobile-first design. Sidebar becomes bottom tab bar on mobile.

## 7. BACKEND DESIGN
* **Services**: Modular design (e.g., `ai.service.ts` for NLP matching, `audit.service.ts` for logging).
* **Controllers**: Grouped by domain (`auth.ts`, `sales.ts`, `boatReports.ts`).
* **Middleware**: `auth.ts` (JWT validation), `rateLimiter.ts` (Redis with memory fallback).
* **Business Logic**: Commission calculation is calculated dynamically in `boatReports.ts` using `commission_rules`.

## 8. AUTHENTICATION & AUTHORIZATION
* **User Roles**: `admin`, `owner`, `agent`, `buyer`.
* **Permissions**: Agents can write sales. Owners can view aggregate data. Buyers can view marketplace.
* **Access Control Rules**: Middleware extracts JWT role and matches against route guards. Frontend layout files enforce client-side redirects.

## 9. PROJECT STRUCTURE
* `apps/frontend/`
  - `src/app/`: Next.js App Router pages and layouts.
  - `src/components/`: Reusable UI components.
  - `src/contexts/`: Global state providers.
  - `src/lib/`: Utilities, Axios instances, Offline Storage logic.
* `apps/backend/`
  - `src/modules/`: Domain controllers and routes.
  - `src/middleware/`: Security and validation.
  - `src/services/`: Core logic.
* `packages/`
  - `database/`: Shared MySQL connection pool.
  - `shared-types/`: TS interfaces used by both apps.
  - `ui/`: Shared base components.

## 10. DEVELOPMENT STATUS
* **Login & Auth**: Completed.
* **Agent Dashboard (Sales, Slips, Voice)**: Completed.
* **Owner Dashboard**: Completed.
* **Offline Sync**: Completed.
* **Push Notifications**: Completed.
* **Buyer Marketplace**: In Progress (Stubbed UI only).
* **Admin Panel**: Not Started.

## 11. CURRENT IMPLEMENTATION
All code is located in the local workspace directory `c:\coding_program_files\FISH_MARKET`.
* **Source Code**: Fully typed, linted, and tested.
* **Configurations**: `turbo.json`, `tsconfig.json`, `eslint.config.js`.
* **Deployment Files**: `apps/frontend/Dockerfile`, `apps/backend/Dockerfile`, `infrastructure/k8s/`, `infrastructure/docker/docker-compose.yml`.

## 12. REMAINING TASKS
* **High**: Implement Buyer Marketplace `/customer` backend routes and live socket updates.
* **Medium**: Build Admin Panel `/admin` for user management and global dispute resolution.
* **Low**: Add dynamic commission rate fetching to `AgentView.tsx` (currently hardcoded to `3%` to match DB defaults).

## 13. BUGS AND KNOWN ISSUES
* No known critical or high severity bugs. 
* 23 major bugs were successfully mapped and eliminated during the previous 5-phase audit.
* Type-check and Lint passing with 0 errors. Vitest suite fully passing.

## 14. DEPLOYMENT DETAILS
* **Hosting**: Containerized environments.
* **Docker Setup**: Monorepo Dockerfiles for apps, `docker-compose.yml` for local DB/Redis provisioning.
* **CI/CD**: Prepared for GitHub Actions (standard `npx turbo run build test lint`).
* **Environment Setup**: Requires `.env` configuration for `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, and Firebase config keys.

## 15. CODEX INSTRUCTIONS

### How the project works
This is a Turborepo-powered monorepo. The backend uses Express and MySQL, exposing REST APIs consumed by a Next.js App Router frontend. Authentication is handled securely via HttpOnly cookies (no JWTs in local storage). The frontend heavily utilizes IndexedDB and Service Workers to allow maritime agents to log sales offline, syncing gracefully when connectivity returns.

### What has been completed
All core Agent and Owner flows, Authentication (including Google OAuth and OTP), Database schema and integrity constraints, Voice-to-text NLP parsing for Tamil/English, and strict rate limiting. A massive bug-fixing audit was just completed ensuring 100% test passing, 0 TypeScript errors, and 0 ESLint warnings.

### What remains to be built
The `Buyer Marketplace` is currently a mocked stub. Your primary next objective is to build out the real-time auction and bidding endpoints on the backend and integrate them into the frontend. The `Admin Panel` is also completely unbuilt.

### Development Priorities
1. Buyer Marketplace Backend Integration
2. WebSocket / Live Polling for real-time bids
3. Admin Panel

### Coding Standards
* Strictly type all new code. `any` is forbidden.
* Do not use `setTimeout` to handle React mount lifecycles.
* Use `lucide-react` for icons.
* All new strings must be added to the bilingual `T` objects in `i18n.ts` or component local dictionaries.

### Folder Structure Rules
* Shared types MUST go into `packages/shared-types`.
* Database queries MUST be exported from or run using `packages/database`.
* Backend routes go in `apps/backend/src/modules/`.
* Frontend pages use Next.js 14 App Router conventions in `apps/frontend/src/app/`.

### Deployment Requirements
Ensure any new environment variables are added to `.env.example`. Test build passing via `npx turbo run build` before considering any task complete. The infrastructure uses Docker, so do not rely on local file system state for persistence.

---
**END OF DOCUMENT**
