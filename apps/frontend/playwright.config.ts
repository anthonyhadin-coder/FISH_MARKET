import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: process.env.CI ? 180000 : 120000,
  globalTimeout: 300000,
  expect: {
    timeout: 30000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      threshold: 0.2,
    }
  },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    actionTimeout: 15000,
    navigationTimeout: 60000,  // ← increase from default 30s
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: ['--disable-web-security'],
    },
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    /* 💻 Desktop */
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/agent.json',
      },
      dependencies: ['setup'],
    },
    /* 📱 Mobile Android */
    {
      name: 'Mobile Pixel 5',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/agent.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      command: 'cd server && npm run dev',
      url: 'http://localhost:5000/health',
      timeout: 180000,
      reuseExistingServer: true,
      env: {
        NODE_ENV: 'e2e',
        PORT: '5000',
      }
    },
    {
      command: 'cd client && npm run dev',
      url: 'http://localhost:3000',
      timeout: 180000,
      reuseExistingServer: true,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:5000/api',
      }
    }
  ],
});
