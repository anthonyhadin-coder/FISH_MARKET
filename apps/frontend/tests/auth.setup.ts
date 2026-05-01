import { test as setup, expect } from '@playwright/test';

setup('save agent auth state', async ({ page }) => {
  await page.goto('/login');
  
  // Use actual demo agent credentials
  await page.fill('[data-testid="phone-input"]', '9876543210');
  await page.fill('[data-testid="password-input"]', 'password123');
  await page.click('[data-testid="login-button"]');
  
  // Wait for dashboard to load
  await expect(page).toHaveURL(/.*agent/, { timeout: 15000 });

  // Save auth cookies
  await page.context().storageState({
    path: 'playwright/.auth/agent.json'
  });
});
