import { test, expect } from '@playwright/test';
import { setupUniversalMocking } from './test-utils';

test.describe('PWA & Feature Verification', () => {
    test.beforeEach(async ({ page }) => {
        // Consolidated API mocks and __PLAYWRIGHT_TEST__ flag
        await setupUniversalMocking(page);

        await page.goto('/staff');
        
        await expect(page).toHaveURL(/.*staff/);
        // Wait for unique heading to avoid hydration/strict-mode issues
        await expect(page.getByTestId('dashboard-heading')).toBeVisible({ timeout: 15000 });
    });

    test('should show offline indicator and sync notification', async ({ page }) => {
        // Ensure EntryTab is visible before going offline
        await expect(page.locator('input[id="wt"]')).toBeVisible();

        await page.context().setOffline(true);
        // Wait for offline state and for the banner to appear
        await page.waitForTimeout(2000);
        await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible({ timeout: 10000 });
        
        // Use reliable data-testid selectors for the entry form
        await page.getByTestId('input-fish').fill('Test Fish');
        await page.getByTestId('input-weight').fill('10.5');
        await page.getByTestId('input-rate').fill('100');
        
        // Scroll and click
        const addBtn = page.locator('[data-testid="add-row-btn"]');
        await addBtn.scrollIntoViewIfNeeded();
        await addBtn.click({ force: true });
        
        // Confirm browser is offline before polling for the toast
        await page.waitForFunction(() => navigator.onLine === false);
        await expect(page.locator('[data-testid="toast"]').filter({ hasText: 'Saved offline' }))
            .toBeVisible({ timeout: 20000 });

        await page.context().setOffline(false);
        await page.waitForTimeout(1000); 
    });

    test('should generate PDF', async ({ page }) => {
        // Switch to reports/slip tab
        await page.click('[data-testid="slip-tab"]', { force: true });
        await page.waitForTimeout(1000); // Wait for AnimatePresence
        
        const pdfBtn = page.locator('[data-testid="download-pdf-btn"]').first();
        await expect(pdfBtn).toBeVisible();
        await pdfBtn.click({ force: true });
    });

    test('should switch languages', async ({ page }) => {
        const langToggleSelector = '[data-testid="language-toggle"]';
        
        // Initial check (English "Boat" or "BOAT")
        await expect(page.locator('[data-testid="boat-label"]').first()).toHaveText(/boat/i, { timeout: 15000 });
        
        // Toggle to Tamil
        const toggle = page.locator(langToggleSelector).first();
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click({ force: true });
        
        // Wait for ANY Tamil characters in the boat label
        await expect(async () => {
          const boatLabel = page.locator('[data-testid="boat-label"]').last();
          await expect(boatLabel).toBeVisible({ timeout: 5000 });
          const text = await boatLabel.innerText();
          if (!/[\u0B80-\u0BFF]/.test(text)) {
            throw new Error('Tamil text not found');
          }
        }).toPass({ timeout: 15000 });
        
        // Toggle back to English
        await toggle.click({ force: true });
        await expect(page.locator('[data-testid="boat-label"]').last()).toHaveText(/boat/i, { timeout: 15000 });
    });
});
