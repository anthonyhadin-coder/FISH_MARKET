# 🐟 Deep Ocean Fish Market PWA

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
- **State & Data:** IndexedDB (idb) for local caching, Axios for networking.
- **Authentication:** `@react-oauth/google` with custom robust token-refresh logic.
- **Icons & UI:** Lucide React.
- **PDF Generation:** jsPDF for generating invoices, receipts, and reports.

### Server (`/server`)
- **Runtime:** Node.js (v20+) with Express 5.
- **Database:** MySQL2 for persistent relational data, Redis (ioredis) for caching, queued operations, and atomic counters.
- **Authentication:** JWT, bcryptjs, google-auth-library.
- **Security:** Helmet, express-rate-limit, cors.
- **Notifications:** Web Push for native notifications.
- **Process Management:** PM2 for production process management.

### Testing & Tooling
- **E2E Testing:** Playwright
- **Unit/Integration Testing:** Vitest, React Testing Library, Supertest.
- **Observability:** Sentry for full-stack error tracking and profiling.

## 🚀 Getting Started

### Prerequisites
- Node.js (v20.0.0 or higher)
- MySQL Database
- Redis Server
- Google OAuth Credentials

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/fish_market.git
   cd fish_market
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install Frontend Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

4. **Environment Variables:**
   - View the `.env.example` in the root folder.
   - Create your `.env` configuration file to fill in your database credentials, Redis URL, JWT secrets, and Google OAuth Client IDs.

### Running the Application Locally

You can run the application servers using the development scripts or Docker.

**Start the Backend:**
```bash
cd server
npm run dev
```

**Start the Frontend:**
```bash
cd client
npm run dev
```

The app will be available at `http://localhost:3000`.

## 🧪 Testing
We use **Vitest** for unit tests and **Playwright** for end-to-end tests.
- To run tests, execute `npm run test` in the respective directories.
- Playwright E2E tests are configured at the root (`playwright.config.ts`).

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📄 License
This project is licensed under the ISC License.
