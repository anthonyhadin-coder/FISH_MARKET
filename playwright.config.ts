import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 120000,
  globalTimeout: 300000,
  expect: {
    timeout: 30000,
    toHaveScreenshot: {
      maxDiffPixels: 100
    }
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
      url: 'http://127.0.0.1:5000/health',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: '5000',
      }
    },
    {
      command: 'cd client && npm start',
      url: 'http://127.0.0.1:3000',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    }
  ],
});
