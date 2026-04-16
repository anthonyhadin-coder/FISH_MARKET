import { test, expect, type Page } from '@playwright/test';
import { setupUniversalMocking } from './test-utils';

test.describe('Visual Regression (Percy/Chromatic)', () => {
  test('Home page visual snapshot', async ({ page }: { page: Page }) => {
    await page.goto('/');
    
    // Using Playwright's native screenshot as a baseline
    await expect(page).toHaveScreenshot('home-page.png', {
      maxDiffPixelRatio: 0.1,
      threshold: 0.2,
      animations: 'disabled'
    });
  });

  test('Voice Input Dialog visual snapshot', async ({ page }: { page: Page }) => {
    // Centralized API mocks and __PLAYWRIGHT_TEST__ flag
    await setupUniversalMocking(page);
    
    await page.goto('/staff');
    
    // Ensure the help button is clickable to open the guide modal
    await page.click('button[title="Help"]', { force: true });
    
    // Wait for fonts to be ready to avoid layout shifts in snapshots
    await page.evaluate(() => document.fonts.ready);
    
    await expect(page.locator('.voice-dialog-container')).toBeVisible({ timeout: 15000 });
    
    // Mask canvas elements as they contain random visualizations
    await expect(page.locator('.voice-dialog-container')).toHaveScreenshot('voice-dialog.png', {
      maxDiffPixelRatio: 0.1,
      mask: [page.locator('canvas')],
      threshold: 0.2,
      animations: 'disabled'
    });
  });
});
