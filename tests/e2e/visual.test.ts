import { test, expect, type Page } from '@playwright/test';

test.describe('Visual Regression (Percy/Chromatic)', () => {
  test('Home page visual snapshot', async ({ page }: { page: Page }) => {
    await page.goto('/');
    
    // Using Playwright's native screenshot as a baseline if Percy is not set up
    await expect(page).toHaveScreenshot('home-page.png', {
      maxDiffPixelRatio: 0.1,
    });
    
    // Integration Hook Examples:
    // await percySnapshot(page, 'Home Page - Deep Ocean');
  });

  test('Voice Input Dialog visual snapshot', async ({ page }: { page: Page }) => {
    await page.goto('/agent/slips');
    await page.click('button[aria-label="Start Voice Input"]');
    
    await expect(page.locator('.voice-dialog-container')).toHaveScreenshot('voice-dialog.png');
  });
});
