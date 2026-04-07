# 🐟 Deep Ocean Fish Market PWA

[![CI Pipeline](https://github.com/anthonyhadin-coder/FISH_MARKET/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/anthonyhadin-coder/FISH_MARKET/actions/workflows/ci.yml)
[![Deploy](https://github.com/anthonyhadin-coder/FISH_MARKET/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/anthonyhadin-coder/FISH_MARKET/actions/workflows/deploy.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple?logo=googlechrome)](https://web.dev/progressive-web-apps/)

Welcome to the **Deep Ocean Fish Market**, a high-performance Progressive Web Application (PWA) designed to seamlessly digitize the daily operations of a wholesale/retail fish market.

This application bridges the gap between traditional market practices and modern technology by providing powerful business management tools, an offline-first architecture, and intuitive voice commands.

## ✨ Key Features

- **Progressive Web App (PWA):** Installable on mobile and desktop devices with native-like performance and capabilities.
- **Offline-First Architecture:** Ensures seamless operation even with poor or no internet connectivity. Mutations are queued and synced automatically when the user comes back online using IndexedDB.
- **Voice Commerce UI:** Features robust integration with voice recognition (including Tamil Number Parsing and a dedicated Voice Queue) for hands-free operations in a busy market environment.
- **Role-Based Access Control:** Secure, robust authentication with Google OAuth integration and dedicated flows for Owners, Staff, and Customers.
- **Real-Time Data Sync:** Provides atomic operations and robust state hydration to keep inventory and ledgers consistently up-to-date.
- **Secure & Production Ready:** Hardened security with SameSite cookies, JWT authentication, and stateless logout denylists.

## 🏗️ Technology Stack

The project is structured as a monorepo containing both the frontend and backend services:

### Client (`/client`)
- **Framework:** [Next.js 16](https://nextjs.org/) (React 19)
- **Styling:** Tailwind CSS V4 & Framer Motion for beautiful, fluid micro-animations.
- **State & Data:** IndexedDB (idb) for local caching, Axios for networking with silent token refresh.
- **Authentication:** `@react-oauth/google` with HttpOnly cookie-based JWT auth.
- **Icons & UI:** Lucide React.
- **PDF Generation:** jsPDF for generating invoices, receipts, and reports.

### Server (`/server`)
- **Runtime:** Node.js (v20+) with Express 5.
- **Database:** MySQL2 for persistent relational data, Redis (ioredis) for caching, queued operations, and atomic counters.
- **Authentication:** JWT HttpOnly cookies, bcryptjs, google-auth-library, Redis token denylist.
- **Security:** Helmet, express-rate-limit, cors.
- **Notifications:** Web Push for native notifications.
- **Process Management:** PM2 for production process management.

### Testing & Tooling
- **E2E Testing:** Playwright (Chromium + Mobile Pixel 5)
- **Unit/Integration Testing:** Vitest, React Testing Library, Supertest.
- **Observability:** Sentry for full-stack error tracking and profiling.
- **CI/CD:** GitHub Actions (lint → test → E2E → deploy)

## 🚀 Getting Started

### Prerequisites
- Node.js (v20.0.0 or higher)
- MySQL 8.0+
- Redis 7+
- Google OAuth Credentials

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/deep-ocean-fish-market.git
   cd deep-ocean-fish-market
   ```

2. **Install all dependencies at once:**
   ```bash
   npm run install:all
   ```

3. **Environment Variables:**
   - Copy `.env.example` to `server/.env` and `client/.env.local`
   - Fill in your database credentials, Redis URL, JWT secrets, and Google OAuth Client IDs.
   - See [`.github/SECRETS_TEMPLATE.md`](.github/SECRETS_TEMPLATE.md) for a full secrets reference.

### Running the Application Locally

Start **both** client and server simultaneously (recommended):
```bash
npm run dev
```

Or start them individually:
```bash
# Backend only (http://localhost:5000)
cd server && npm run dev

# Frontend only (http://localhost:3000)
cd client && npm run dev
```

## 🧪 Testing

```bash
# Run all unit + integration tests
npm run test

# Run Playwright E2E tests
npm run test:e2e

# Lint both client and server
npm run lint
```

## ⚙️ CI/CD Pipeline

Every push to `main` triggers the full GitHub Actions pipeline:

```
git push origin main
        ↓
  ✅ ESLint — Client & Server
  ✅ Vitest Unit Tests — Client
  ✅ Supertest Integration Tests — Server
        ↓
  ✅ Playwright E2E Tests (Chromium + Mobile)
        ↓
  ✅ Build Next.js PWA
  ✅ Deploy Client → Vercel
  ✅ Deploy Server → VPS via SSH + PM2
        ↓
  🎉 Deep Ocean Fish Market is LIVE!
```

See [`.github/SECRETS_TEMPLATE.md`](.github/SECRETS_TEMPLATE.md) for all required GitHub secrets.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📄 License
This project is licensed under the ISC License.
